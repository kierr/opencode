import { BaseMCPServer } from "../../server/BaseMCPServer.js"
import { SessionContext, SessionConfig } from "../../config/MCPConfig.js"
import { z } from "zod/v4"

const ZAI_SESSION_CONFIG: SessionConfig = {
  required: true,
  authHeaders: ["session-id"],
  sessionIdHeader: "session-id",
  ttl: 30 * 60 * 1000, // 30 minutes
}

const ZaiToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()),
})

const ZaiVisionInputSchema = z.object({
  image_source: z.string().url().or(z.string().startsWith("/")),
  prompt: z.string().min(1),
})

const ZaiVideoInputSchema = z.object({
  video_source: z.string().url().or(z.string().startsWith("/")),
  prompt: z.string().min(1),
})

export class ZAIMCPServer extends BaseMCPServer {
  constructor() {
    super("zai", ZAI_SESSION_CONFIG)
  }

  protected async listTools(sessionContext: SessionContext): Promise<any> {
    return this.withSessionContext(sessionContext, async () => {
      const tools = [
        {
          name: "zai-vision_analyze_image",
          description:
            "Analyze an image using advanced AI vision models with comprehensive understanding capabilities. Supports both local files and remote URL. Maximum file size: 5MB",
          inputSchema: {
            type: "object",
            properties: {
              image_source: {
                type: "string",
                description: "Local file path or remote URL to the image (supports PNG, JPG, JPEG)",
              },
              prompt: {
                type: "string",
                description:
                  "Detailed text prompt. If the task is front-end code replication, the prompt must include detailed layout structure, color style, main components, and interactive elements description",
              },
            },
            required: ["image_source", "prompt"],
          },
        },
        {
          name: "zai-vision_analyze_video",
          description:
            "Analyze a video using advanced AI vision models with comprehensive understanding capabilities. Supports both local files and remote URL. Maximum local file size: 8MB",
          inputSchema: {
            type: "object",
            properties: {
              video_source: {
                type: "string",
                description: "Local file path or remote URL to the video (supports MP4, MOV, M4V)",
              },
              prompt: {
                type: "string",
                description: "Detailed text prompt describing what to analyze, extract, or understand from the video",
              },
            },
            required: ["video_source", "prompt"],
          },
        },
      ]

      return { tools }
    })
  }

  protected async callTool(toolName: string, args: any, sessionContext: SessionContext): Promise<any> {
    return this.withSessionContext(sessionContext, async () => {
      this.log.info("Calling Z.AI tool", { toolName, sessionId: sessionContext.sessionId })

      switch (toolName) {
        case "zai-vision_analyze_image":
          return this.handleImageAnalysis(args, sessionContext)

        case "zai-vision_analyze_video":
          return this.handleVideoAnalysis(args, sessionContext)

        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }
    })
  }

  private async handleImageAnalysis(args: any, sessionContext: SessionContext): Promise<any> {
    try {
      const validated = ZaiVisionInputSchema.parse(args)

      // Add session context to the request
      const enhancedArgs = {
        ...validated,
        session_context: {
          sessionId: sessionContext.sessionId,
          metadata: sessionContext.metadata,
        },
      }

      // Here you would make the actual API call to Z.AI
      // For now, we'll simulate the response
      const result = await this.simulateZAIVisionCall("image", enhancedArgs)

      return this.createToolResponse(result)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.createErrorResponse(`Invalid input: ${error.errors.map((e) => e.message).join(", ")}`)
      }
      return this.createErrorResponse(`Image analysis failed: ${error.message}`)
    }
  }

  private async handleVideoAnalysis(args: any, sessionContext: SessionContext): Promise<any> {
    try {
      const validated = ZaiVideoInputSchema.parse(args)

      // Add session context to the request
      const enhancedArgs = {
        ...validated,
        session_context: {
          sessionId: sessionContext.sessionId,
          metadata: sessionContext.metadata,
        },
      }

      // Here you would make the actual API call to Z.AI
      // For now, we'll simulate the response
      const result = await this.simulateZAIVisionCall("video", enhancedArgs)

      return this.createToolResponse(result)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.createErrorResponse(`Invalid input: ${error.errors.map((e) => e.message).join(", ")}`)
      }
      return this.createErrorResponse(`Video analysis failed: ${error.message}`)
    }
  }

  private async simulateZAIVisionCall(type: "image" | "video", args: any): Promise<any> {
    // This is a simulation - in a real implementation, you would:
    // 1. Make an HTTP request to Z.AI's API
    // 2. Include the session headers
    // 3. Handle the response appropriately

    this.log.info(`Simulating Z.AI ${type} analysis`, {
      source: args[type === "image" ? "image_source" : "video_source"],
      sessionId: args.session_context.sessionId,
    })

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return {
      analysis: `Simulated ${type} analysis result for ${args[type === "image" ? "image_source" : "video_source"]}`,
      session_id: args.session_context.sessionId,
      processed_at: new Date().toISOString(),
      type,
      prompt: args.prompt,
    }
  }

  protected getSessionMetadata(sessionContext: SessionContext, key: string): any {
    const value = super.getSessionMetadata(sessionContext, key)
    if (value) {
      return value
    }

    // Z.AI specific metadata handling
    switch (key) {
      case "user_id":
        return sessionContext.headers["x-user-id"] || sessionContext.metadata["x-user-id"]
      case "api_key":
        return sessionContext.headers["x-api-key"] || sessionContext.metadata["x-api-key"]
      case "tier":
        return sessionContext.headers["x-tier"] || sessionContext.metadata["x-tier"] || "free"
      default:
        return undefined
    }
  }

  protected isSessionValid(sessionContext: SessionContext): boolean {
    const baseValid = super.isSessionValid(sessionContext)
    if (!baseValid) {
      return false
    }

    // Z.AI specific validation
    const sessionId = this.getSessionHeader(sessionContext, "session-id")
    if (!sessionId || sessionId.length < 10) {
      return false
    }

    // Check if session has required Z.AI metadata
    const userId = this.getSessionMetadata(sessionContext, "user_id")
    if (!userId) {
      this.log.warn("Z.AI session missing user_id", { sessionId })
      return false
    }

    return true
  }
}

// Factory function to create and start the Z.AI server
export async function createZAIMCPServer(): Promise<ZAIMCPServer> {
  const server = new ZAIMCPServer()
  await server.start()
  return server
}

// CLI entry point
if (import.meta.main) {
  createZAIMCPServer().catch(console.error)
}
