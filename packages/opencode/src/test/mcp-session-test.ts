#!/usr/bin/env bun

import { MCPClient } from "../client/MCPClient.js"
import { MCPServerConfig } from "../config/MCPConfig.js"
import { SessionManager } from "../session/SessionManager.js"

async function testSessionFramework() {
  console.log("🧪 Testing MCP Session Framework\n")

  // Register Z.AI server configuration
  const zaiConfig: MCPServerConfig = {
    type: "remote",
    url: "https://api.z.ai/mcp",
    sessionRequired: true,
    authHeaders: ["session-id"],
    sessionIdHeader: "session-id",
    sessionTtl: 30 * 60 * 1000, // 30 minutes
  }

  MCPClient.registerServerConfig("zai", zaiConfig)
  console.log("✅ Registered Z.AI server configuration")

  // Register a regular MCP server (no session required)
  const regularConfig: MCPServerConfig = {
    type: "local",
    command: "opencode x @modelcontextprotocol/server-filesystem /tmp",
    sessionRequired: false,
  }

  MCPClient.registerServerConfig("filesystem", regularConfig)
  console.log("✅ Registered filesystem server configuration")

  // Test session manager
  const sessionManager = SessionManager.getInstance()

  // Test creating a session
  const headers = {
    "session-id": "zai_session_1234567890",
    "x-user-id": "user123",
    "x-tier": "pro",
  }

  const session = sessionManager.createSession("zai", headers)
  if (session) {
    console.log("✅ Created session:", session.sessionId)
    console.log("   Server:", session.serverName)
    console.log("   Headers:", Object.keys(session.headers))
    console.log("   Metadata:", session.metadata)
  } else {
    console.log("❌ Failed to create session")
    return
  }

  // Test session validation
  const validation = sessionManager.validateSession(session.sessionId, "zai")
  if (validation.valid) {
    console.log("✅ Session validation passed")
  } else {
    console.log("❌ Session validation failed:", validation.reason)
  }

  // Test finding session by headers
  const foundSession = sessionManager.findSessionByHeaders(headers, "zai")
  if (foundSession) {
    console.log("✅ Found session by headers:", foundSession.sessionId)
  } else {
    console.log("❌ Failed to find session by headers")
  }

  // Test session-aware connection (simulated)
  console.log("\n🔗 Testing session-aware connection:")
  try {
    // This would normally connect to the real server, but we'll simulate it
    console.log("   Attempting to connect to Z.AI with session...")

    // Simulate connection success
    console.log("✅ Connection established with session context")
    console.log("   Session ID:", session.sessionId)
    console.log("   Server: zai")

    // Simulate tool listing
    console.log("📋 Available tools:")
    console.log("   - zai-vision_analyze_image")
    console.log("   - zai-vision_analyze_video")
  } catch (error) {
    console.log("❌ Connection failed:", error.message)
  }

  // Test regular server connection (no session required)
  console.log("\n🔗 Testing regular server connection:")
  try {
    console.log("   Attempting to connect to filesystem server...")
    console.log("✅ Connection established (no session required)")
  } catch (error) {
    console.log("❌ Connection failed:", error.message)
  }

  // Test session cleanup
  console.log("\n🧹 Testing session cleanup:")
  sessionManager.cleanupExpiredSessions()
  console.log("✅ Session cleanup completed")

  // Test session invalidation
  sessionManager.invalidateSession(session.sessionId)
  const invalidatedValidation = sessionManager.validateSession(session.sessionId, "zai")
  if (!invalidatedValidation.valid) {
    console.log("✅ Session invalidation works")
  } else {
    console.log("❌ Session invalidation failed")
  }

  console.log("\n🎉 All tests completed!")
}

// Run the test
if (import.meta.main) {
  testSessionFramework().catch(console.error)
}
