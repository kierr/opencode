import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js"
import { SessionContext, SessionConfig } from "../config/MCPConfig.js"
import { SessionManager } from "../session/SessionManager.js"
import { Log } from "../util/log"

export abstract class BaseMCPServer {
  protected server: Server
  protected sessionManager: SessionManager
  protected serverName: string
  protected sessionConfig: SessionConfig
  protected log: any

  constructor(serverName: string, sessionConfig: SessionConfig) {
    this.serverName = serverName
    this.sessionConfig = sessionConfig
    this.sessionManager = SessionManager.getInstance()
    this.sessionManager.registerServerConfig(serverName, sessionConfig)

    this.log = Log.create({ service: `mcp.server.${serverName}` })

    this.server = new Server(
      {
        name: serverName,
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    )

    this.setupHandlers()
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      const sessionContext = this.validateSession(request)
      return this.listTools(sessionContext)
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const sessionContext = this.validateSession(request)
      return this.callTool(request.params.name, request.params.arguments, sessionContext)
    })
  }

  protected validateSession(request: any): SessionContext {
    if (!this.sessionConfig.required) {
      return {
        sessionId: "anonymous",
        serverName: this.serverName,
        headers: {},
        metadata: {},
        createdAt: new Date(),
        lastAccessed: new Date(),
        isValid: true,
      }
    }

    const headers = this.extractHeaders(request)
    const sessionContext = this.sessionManager.findSessionByHeaders(headers, this.serverName)

    if (!sessionContext) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Session required for ${this.serverName}. Please provide valid session headers.`,
      )
    }

    const validation = this.sessionManager.validateSession(sessionContext.sessionId, this.serverName)
    if (!validation.valid) {
      throw new McpError(ErrorCode.InvalidRequest, `Invalid session: ${validation.reason}`)
    }

    return sessionContext
  }

  protected extractHeaders(request: any): Record<string, string> {
    const headers: Record<string, string> = {}

    if (request.params?.meta?.headers) {
      Object.assign(headers, request.params.meta.headers)
    }

    if (request.meta?.headers) {
      Object.assign(headers, request.meta.headers)
    }

    return headers
  }

  protected abstract listTools(sessionContext: SessionContext): Promise<any>
  protected abstract callTool(toolName: string, args: any, sessionContext: SessionContext): Promise<any>

  protected createToolResponse(content: any, isError = false): any {
    return {
      content: [
        {
          type: "text",
          text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
        },
      ],
      isError,
    }
  }

  protected createErrorResponse(message: string, error?: any): any {
    this.log.error("Tool error", { message, error })
    return this.createToolResponse(`Error: ${message}`, true)
  }

  protected async withSessionContext<T>(sessionContext: SessionContext, operation: () => Promise<T>): Promise<T> {
    try {
      this.log.debug("Executing operation with session", {
        sessionId: sessionContext.sessionId,
        serverName: sessionContext.serverName,
      })

      const result = await operation()

      this.log.debug("Operation completed successfully", {
        sessionId: sessionContext.sessionId,
      })

      return result
    } catch (error) {
      this.log.error("Operation failed", {
        sessionId: sessionContext.sessionId,
        error,
      })
      throw error
    }
  }

  protected getSessionMetadata(sessionContext: SessionContext, key: string): any {
    return sessionContext.metadata[key]
  }

  protected getSessionHeader(sessionContext: SessionContext, header: string): string | undefined {
    return sessionContext.headers[header]
  }

  protected isSessionValid(sessionContext: SessionContext): boolean {
    const validation = this.sessionManager.validateSession(sessionContext.sessionId, this.serverName)
    return validation.valid
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    this.log.info(`${this.serverName} MCP server started`)
  }

  async stop(): Promise<void> {
    this.log.info(`Stopping ${this.serverName} MCP server`)
    await this.server.close()
  }

  protected getServerName(): string {
    return this.serverName
  }

  protected getSessionConfig(): SessionConfig {
    return this.sessionConfig
  }
}
