import { z } from "zod/v4"

export interface SessionContext {
  sessionId: string
  serverName: string
  headers: Record<string, string>
  metadata: Record<string, any>
  createdAt: Date
  lastAccessed: Date
  isValid: boolean
}

export interface SessionConfig {
  required: boolean
  authHeaders: string[]
  sessionIdHeader?: string
  ttl?: number
}

export interface SessionValidationResult {
  valid: boolean
  reason?: string
}

export const MCPServerConfig = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("local"),
    command: z.string(),
    env: z.record(z.string(), z.string()).optional(),
    sessionRequired: z.boolean().optional(),
    authHeaders: z.array(z.string()).optional(),
    sessionIdHeader: z.string().optional(),
    sessionTtl: z.number().optional(),
  }),
  z.object({
    type: z.literal("remote"),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
    sessionRequired: z.boolean().optional(),
    authHeaders: z.array(z.string()).optional(),
    sessionIdHeader: z.string().optional(),
    sessionTtl: z.number().optional(),
  }),
])

export type MCPServerConfig = z.infer<typeof MCPServerConfig>

export const SessionConfigSchema = z.object({
  required: z.boolean(),
  authHeaders: z.array(z.string()),
  sessionIdHeader: z.string().optional(),
  ttl: z.number().optional(),
})

export type SessionConfigType = z.infer<typeof SessionConfigSchema>
