import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { MCPServerConfig, SessionContext } from "../config/MCPConfig.js"
import { SessionManager } from "../session/SessionManager.js"
import { Log } from "../util/log"

export namespace MCPClient {
  const log = Log.create({ service: "mcp.client" })

  export interface ConnectionOptions {
    serverName: string
    config: MCPServerConfig
    headers?: Record<string, string>
    sessionContext?: SessionContext
  }

  export interface MCPConnection {
    client: Client
    transport: any
    sessionContext?: SessionContext
    serverName: string
    disconnect(): Promise<void>
  }

  export async function createConnection(options: ConnectionOptions): Promise<MCPConnection> {
    const l = log.clone().tag("serverName", options.serverName)
    l.info("creating MCP connection")

    const sessionManager = SessionManager.getInstance()
    let sessionContext = options.sessionContext

    if (!sessionContext && options.headers) {
      sessionContext = sessionManager.findSessionByHeaders(options.headers, options.serverName)
    }

    if (!sessionContext && options.headers) {
      sessionContext = sessionManager.createSession(options.serverName, options.headers)
    }

    const client = new Client({
      name: "opencode",
      version: "1.0.0",
    })

    let transport: any

    switch (options.config.type) {
      case "remote":
        const url = new URL(options.config.url!)
        transport = new StreamableHTTPClientTransport(url, {
          headers: {
            ...options.headers,
            ...(sessionContext?.headers || {}),
          },
        })
        break

      case "local":
        transport = new StdioClientTransport({
          command: options.config.command!.split(" "),
          env: {
            ...process.env,
            ...(sessionContext?.metadata || {}),
          },
        })
        break

      default:
        throw new Error(`Unsupported MCP server type: ${options.config.type}`)
    }

    await client.connect(transport)
    l.info("MCP connection established")

    return {
      client,
      transport,
      sessionContext,
      serverName: options.serverName,
      async disconnect() {
        l.info("disconnecting MCP connection")
        await client.close()
        if (transport?.close) {
          await transport.close()
        }
      },
    }
  }

  export async function createSessionAwareConnection(
    serverName: string,
    headers: Record<string, string>,
  ): Promise<MCPConnection | null> {
    const sessionManager = SessionManager.getInstance()
    const config = sessionManager.getServerConfig(serverName)

    if (!config) {
      log.warn("No configuration found for server", { serverName })
      return null
    }

    const sessionContext = sessionManager.findSessionByHeaders(headers, serverName)
    if (!sessionContext && config.required) {
      log.warn("No valid session found for session-aware server", { serverName })
      return null
    }

    return createConnection({
      serverName,
      config: config as MCPServerConfig,
      headers,
      sessionContext,
    })
  }

  export async function validateAndConnect(
    serverName: string,
    headers: Record<string, string>,
  ): Promise<MCPConnection> {
    const sessionManager = SessionManager.getInstance()
    const config = sessionManager.getServerConfig(serverName)

    if (!config) {
      throw new Error(`No configuration found for server: ${serverName}`)
    }

    if (config.required) {
      const sessionContext = sessionManager.findSessionByHeaders(headers, serverName)
      if (!sessionContext) {
        throw new Error(`Session required for server: ${serverName}`)
      }

      const validation = sessionManager.validateSession(sessionContext.sessionId, serverName)
      if (!validation.valid) {
        throw new Error(`Invalid session: ${validation.reason}`)
      }
    }

    return createConnection({
      serverName,
      config: config as MCPServerConfig,
      headers,
    })
  }

  export function registerServerConfig(serverName: string, config: MCPServerConfig): void {
    const sessionManager = SessionManager.getInstance()

    const sessionConfig: SessionConfig = {
      required: config.sessionRequired || false,
      authHeaders: config.authHeaders || [],
      sessionIdHeader: config.sessionIdHeader,
      ttl: config.sessionTtl,
    }

    sessionManager.registerServerConfig(serverName, sessionConfig)
  }

  export async function listAvailableTools(connection: MCPConnection): Promise<any[]> {
    try {
      const result = await connection.client.listTools()
      return result.tools || []
    } catch (error) {
      log.error("Failed to list tools", { error, serverName: connection.serverName })
      return []
    }
  }

  export async function callTool(connection: MCPConnection, toolName: string, args: any = {}): Promise<any> {
    try {
      const result = await connection.client.callTool({
        name: toolName,
        arguments: args,
      })
      return result
    } catch (error) {
      log.error("Failed to call tool", { error, toolName, serverName: connection.serverName })
      throw error
    }
  }

  export async function listResources(connection: MCPConnection): Promise<any[]> {
    try {
      const result = await connection.client.listResources()
      return result.resources || []
    } catch (error) {
      log.error("Failed to list resources", { error, serverName: connection.serverName })
      return []
    }
  }

  export async function readResource(connection: MCPConnection, uri: string): Promise<any> {
    try {
      const result = await connection.client.readResource({ uri })
      return result
    } catch (error) {
      log.error("Failed to read resource", { error, uri, serverName: connection.serverName })
      throw error
    }
  }
}
