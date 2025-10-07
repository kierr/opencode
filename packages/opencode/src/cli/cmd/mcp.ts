import { cmd } from "./cmd"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { MCPClient } from "../../client/MCPClient.js"
import { MCPServerConfig } from "../../config/MCPConfig.js"

export const McpCommand = cmd({
  command: "mcp",
  builder: (yargs) => yargs.command(McpAddCommand).command(McpAddZAICommand).demandCommand(),
  async handler() {},
})

export const McpAddCommand = cmd({
  command: "add",
  describe: "add an MCP server",
  async handler() {
    UI.empty()
    prompts.intro("Add MCP server")

    const name = await prompts.text({
      message: "Enter MCP server name",
      validate: (x) => (x && x.length > 0 ? undefined : "Required"),
    })
    if (prompts.isCancel(name)) throw new UI.CancelledError()

    const type = await prompts.select({
      message: "Select MCP server type",
      options: [
        {
          label: "Local",
          value: "local",
          hint: "Run a local command",
        },
        {
          label: "Remote",
          value: "remote",
          hint: "Connect to a remote URL",
        },
      ],
    })
    if (prompts.isCancel(type)) throw new UI.CancelledError()

    if (type === "local") {
      const command = await prompts.text({
        message: "Enter command to run",
        placeholder: "e.g., opencode x @modelcontextprotocol/server-filesystem",
        validate: (x) => (x && x.length > 0 ? undefined : "Required"),
      })
      if (prompts.isCancel(command)) throw new UI.CancelledError()

      const sessionRequired = await prompts.confirm({
        message: "Does this server require session authentication?",
        initialValue: false,
      })
      if (prompts.isCancel(sessionRequired)) throw new UI.CancelledError()

      let authHeaders: string[] = []
      let sessionIdHeader: string | undefined

      if (sessionRequired) {
        const authHeaderInput = await prompts.text({
          message: "Enter authentication headers (comma-separated)",
          placeholder: "e.g., session-id, authorization",
        })
        if (prompts.isCancel(authHeaderInput)) throw new UI.CancelledError()

        authHeaders = authHeaderInput
          .split(",")
          .map((h) => h.trim())
          .filter((h) => h.length > 0)

        const sessionIdHeaderInput = await prompts.text({
          message: "Enter session ID header name (optional)",
          placeholder: "e.g., session-id",
        })
        if (!prompts.isCancel(sessionIdHeaderInput) && sessionIdHeaderInput) {
          sessionIdHeader = sessionIdHeaderInput.trim()
        }
      }

      const config: MCPServerConfig = {
        type: "local",
        command,
        sessionRequired: sessionRequired || false,
        authHeaders: authHeaders.length > 0 ? authHeaders : undefined,
        sessionIdHeader,
      }

      MCPClient.registerServerConfig(name, config)

      prompts.log.info(`Local MCP server "${name}" configured with command: ${command}`)
      if (sessionRequired) {
        prompts.log.info(`Session authentication enabled with headers: ${authHeaders.join(", ")}`)
      }
      prompts.outro("MCP server added successfully")
      return
    }

    if (type === "remote") {
      const url = await prompts.text({
        message: "Enter MCP server URL",
        placeholder: "e.g., https://example.com/mcp",
        validate: (x) => {
          if (!x) return "Required"
          if (x.length === 0) return "Required"
          const isValid = URL.canParse(x)
          return isValid ? undefined : "Invalid URL"
        },
      })
      if (prompts.isCancel(url)) throw new UI.CancelledError()

      const sessionRequired = await prompts.confirm({
        message: "Does this server require session authentication?",
        initialValue: false,
      })
      if (prompts.isCancel(sessionRequired)) throw new UI.CancelledError()

      let authHeaders: string[] = []
      let sessionIdHeader: string | undefined
      let headers: Record<string, string> = {}

      if (sessionRequired) {
        const authHeaderInput = await prompts.text({
          message: "Enter authentication headers (comma-separated)",
          placeholder: "e.g., session-id, authorization",
        })
        if (prompts.isCancel(authHeaderInput)) throw new UI.CancelledError()

        authHeaders = authHeaderInput
          .split(",")
          .map((h) => h.trim())
          .filter((h) => h.length > 0)

        const sessionIdHeaderInput = await prompts.text({
          message: "Enter session ID header name (optional)",
          placeholder: "e.g., session-id",
        })
        if (!prompts.isCancel(sessionIdHeaderInput) && sessionIdHeaderInput) {
          sessionIdHeader = sessionIdHeaderInput.trim()
        }

        // Collect header values
        for (const header of authHeaders) {
          const value = await prompts.text({
            message: `Enter value for header "${header}"`,
            validate: (x) => (x && x.length > 0 ? undefined : "Required"),
          })
          if (!prompts.isCancel(value)) {
            headers[header] = value.trim()
          }
        }
      }

      const config: MCPServerConfig = {
        type: "remote",
        url,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        sessionRequired: sessionRequired || false,
        authHeaders: authHeaders.length > 0 ? authHeaders : undefined,
        sessionIdHeader,
      }

      MCPClient.registerServerConfig(name, config)

      // Test connection
      try {
        const connection = await MCPClient.createConnection({
          serverName: name,
          config,
          headers,
        })
        const tools = await MCPClient.listAvailableTools(connection)
        await connection.disconnect()

        prompts.log.info(`Remote MCP server "${name}" configured with URL: ${url}`)
        prompts.log.info(`Available tools: ${tools.length}`)
        if (sessionRequired) {
          prompts.log.info(`Session authentication enabled with headers: ${authHeaders.join(", ")}`)
        }
      } catch (error) {
        prompts.log.warn(`Warning: Could not connect to server: ${error.message}`)
        prompts.log.info(`Remote MCP server "${name}" configured with URL: ${url}`)
      }
    }

    prompts.outro("MCP server added successfully")
  },
})

export const McpAddZAICommand = cmd({
  command: "add-zai",
  describe: "add Z.AI MCP server with session support",
  async handler() {
    UI.empty()
    prompts.intro("Add Z.AI MCP Server")

    const url = await prompts.text({
      message: "Enter Z.AI MCP server URL",
      placeholder: "e.g., https://api.z.ai/mcp",
      validate: (x) => {
        if (!x) return "Required"
        if (x.length === 0) return "Required"
        const isValid = URL.canParse(x)
        return isValid ? undefined : "Invalid URL"
      },
    })
    if (prompts.isCancel(url)) throw new UI.CancelledError()

    const sessionId = await prompts.text({
      message: "Enter Z.AI Session ID",
      placeholder: "e.g., zai_session_1234567890",
      validate: (x) => (x && x.length > 0 ? undefined : "Required"),
    })
    if (prompts.isCancel(sessionId)) throw new UI.CancelledError()

    const config: MCPServerConfig = {
      type: "remote",
      url,
      sessionRequired: true,
      authHeaders: ["session-id"],
      sessionIdHeader: "session-id",
      sessionTtl: 30 * 60 * 1000, // 30 minutes
    }

    MCPClient.registerServerConfig("zai", config)

    // Test connection with session
    try {
      const connection = await MCPClient.createConnection({
        serverName: "zai",
        config,
        headers: { "session-id": sessionId },
      })
      const tools = await MCPClient.listAvailableTools(connection)
      await connection.disconnect()

      prompts.log.info(`Z.AI MCP server configured with URL: ${url}`)
      prompts.log.info(`Available tools: ${tools.length}`)
      prompts.log.info(`Session authentication enabled`)
    } catch (error) {
      prompts.log.warn(`Warning: Could not connect to Z.AI server: ${error.message}`)
      prompts.log.info(`Z.AI MCP server configured with URL: ${url}`)
      prompts.log.info(`Please check your session ID and server URL`)
    }

    prompts.outro("Z.AI MCP server added successfully")
  },
})
