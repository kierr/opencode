import { SessionContext, SessionConfig, SessionValidationResult } from "../config/MCPConfig.js"

export class SessionManager {
  private static instance: SessionManager
  private sessions: Map<string, SessionContext> = new Map()
  private serverConfigs: Map<string, SessionConfig> = new Map()

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  registerServerConfig(serverName: string, config: SessionConfig): void {
    this.serverConfigs.set(serverName, config)
  }

  createSession(serverName: string, headers: Record<string, string>): SessionContext | null {
    const config = this.serverConfigs.get(serverName)
    if (!config || !config.required) {
      return null
    }

    const sessionId = this.extractSessionId(headers, config)
    if (!sessionId) {
      return null
    }

    const session: SessionContext = {
      sessionId,
      serverName,
      headers: this.sanitizeHeaders(headers, config),
      metadata: this.extractMetadata(headers, config),
      createdAt: new Date(),
      lastAccessed: new Date(),
      isValid: true,
    }

    this.sessions.set(sessionId, session)
    return session
  }

  validateSession(sessionId: string, serverName?: string): SessionValidationResult {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return { valid: false, reason: "Session not found" }
    }

    if (serverName && session.serverName !== serverName) {
      return { valid: false, reason: "Session server mismatch" }
    }

    if (!session.isValid) {
      return { valid: false, reason: "Session invalidated" }
    }

    const config = this.serverConfigs.get(session.serverName)
    if (config?.ttl) {
      const now = new Date()
      const elapsed = now.getTime() - session.lastAccessed.getTime()
      if (elapsed > config.ttl) {
        this.invalidateSession(sessionId)
        return { valid: false, reason: "Session expired" }
      }
    }

    session.lastAccessed = new Date()
    return { valid: true }
  }

  getSession(sessionId: string): SessionContext | null {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastAccessed = new Date()
    }
    return session || null
  }

  invalidateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.isValid = false
    }
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  cleanupExpiredSessions(): void {
    const now = new Date()
    for (const [sessionId, session] of this.sessions.entries()) {
      const config = this.serverConfigs.get(session.serverName)
      if (config?.ttl) {
        const elapsed = now.getTime() - session.lastAccessed.getTime()
        if (elapsed > config.ttl) {
          this.sessions.delete(sessionId)
        }
      }
    }
  }

  findSessionByHeaders(headers: Record<string, string>, serverName: string): SessionContext | null {
    const config = this.serverConfigs.get(serverName)
    if (!config) {
      return null
    }

    const sessionId = this.extractSessionId(headers, config)
    return sessionId ? this.getSession(sessionId) : null
  }

  private extractSessionId(headers: Record<string, string>, config: SessionConfig): string | null {
    if (config.sessionIdHeader) {
      return headers[config.sessionIdHeader] || null
    }

    for (const header of config.authHeaders) {
      const value = headers[header]
      if (value) {
        return value
      }
    }

    return null
  }

  private sanitizeHeaders(headers: Record<string, string>, config: SessionConfig): Record<string, string> {
    const sanitized: Record<string, string> = {}

    for (const header of config.authHeaders) {
      if (headers[header]) {
        sanitized[header] = headers[header]
      }
    }

    if (config.sessionIdHeader && headers[config.sessionIdHeader]) {
      sanitized[config.sessionIdHeader] = headers[config.sessionIdHeader]
    }

    return sanitized
  }

  private extractMetadata(headers: Record<string, string>, config: SessionConfig): Record<string, any> {
    const metadata: Record<string, any> = {}

    for (const [key, value] of Object.entries(headers)) {
      if (key.startsWith("x-") || key.startsWith("x-mcp-")) {
        metadata[key] = value
      }
    }

    return metadata
  }

  getServerConfig(serverName: string): SessionConfig | undefined {
    return this.serverConfigs.get(serverName)
  }

  getAllSessions(): SessionContext[] {
    return Array.from(this.sessions.values())
  }

  getSessionsForServer(serverName: string): SessionContext[] {
    return Array.from(this.sessions.values()).filter((session) => session.serverName === serverName)
  }
}
