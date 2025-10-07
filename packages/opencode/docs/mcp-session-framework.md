# MCP Session Framework

This document describes the session context framework implemented in OpenCode to support MCP servers that require session-based authentication, such as Z.AI.

## Overview

The MCP Session Framework provides a standardized way to handle session-based authentication for MCP servers. It includes:

- **SessionManager**: Core session management and validation
- **MCPClient**: Enhanced client with session support
- **BaseMCPServer**: Base class for session-aware servers
- **Configuration**: Standardized configuration for session requirements

## Key Components

### SessionManager

The `SessionManager` class handles:

- Session creation and validation
- Session lifecycle management (creation, validation, expiration, cleanup)
- Session discovery by headers
- Server configuration registration

```typescript
import { SessionManager } from "./session/SessionManager.js"

const sessionManager = SessionManager.getInstance()
const session = sessionManager.createSession("zai", headers)
const isValid = sessionManager.validateSession(sessionId, "zai")
```

### MCPClient

The enhanced `MCPClient` supports:

- Session-aware connection creation
- Automatic session injection into requests
- Server configuration management
- Session validation before connection

```typescript
import { MCPClient } from "./client/MCPClient.js"

const connection = await MCPClient.createConnection({
  serverName: "zai",
  config: serverConfig,
  headers: { "session-id": "your-session-id" },
})
```

### BaseMCPServer

Base class for implementing session-aware MCP servers:

- Automatic session validation
- Session context injection
- Standardized error handling
- Extensible for server-specific logic

```typescript
import { BaseMCPServer } from "./server/BaseMCPServer.js"

class MyMCPServer extends BaseMCPServer {
  protected async listTools(sessionContext: SessionContext) {
    // Use sessionContext for authenticated operations
  }
}
```

## Configuration

### Server Configuration

MCP servers can be configured with session requirements:

```typescript
const config: MCPServerConfig = {
  type: "remote",
  url: "https://api.example.com/mcp",
  sessionRequired: true,
  authHeaders: ["session-id", "authorization"],
  sessionIdHeader: "session-id",
  sessionTtl: 30 * 60 * 1000, // 30 minutes
}
```

### Session Configuration

Session behavior is configured via `SessionConfig`:

- `required`: Whether session is mandatory
- `authHeaders`: Headers to extract for session
- `sessionIdHeader`: Specific header for session ID
- `ttl`: Session time-to-live in milliseconds

## Usage Examples

### Adding a Session-Aware Server

```bash
# Add Z.AI server with session support
opencode mcp add-zai

# Add custom session-aware server
opencode mcp add
```

### Programmatic Usage

```typescript
import { MCPClient, MCPServerConfig } from "./client/MCPClient.js"

// Register server configuration
const config: MCPServerConfig = {
  type: "remote",
  url: "https://api.z.ai/mcp",
  sessionRequired: true,
  authHeaders: ["session-id"],
  sessionIdHeader: "session-id",
}

MCPClient.registerServerConfig("zai", config)

// Connect with session
const connection = await MCPClient.createConnection({
  serverName: "zai",
  config,
  headers: { "session-id": "your-session-id" },
})
```

## Z.AI Integration

The framework includes specific support for Z.AI MCP server:

### ZAIMCPServer

Specialized implementation for Z.AI:

- Validates Z.AI session format
- Handles Z.AI specific metadata
- Provides vision analysis tools
- Session-aware request processing

### Session Requirements

Z.AI requires:

- `session-id` header with valid session token
- Minimum session ID length (10 characters)
- Optional user metadata (`x-user-id`, `x-tier`)

### Available Tools

- `zai-vision_analyze_image`: Image analysis with AI
- `zai-vision_analyze_video`: Video analysis with AI

## Security Considerations

### Session Validation

- Sessions are validated against server requirements
- Expired sessions are automatically rejected
- Session mismatch between servers is prevented

### Header Sanitization

- Only configured headers are included in sessions
- Sensitive headers are not logged
- Metadata is extracted from safe headers only

### TTL Management

- Sessions automatically expire after configured TTL
- Cleanup runs periodically to remove expired sessions
- Last access time is tracked for TTL calculation

## Error Handling

### Session Errors

- Missing session: Returns clear error message
- Invalid session: Includes validation reason
- Expired session: Automatically cleaned up

### Connection Errors

- Session validation failures before connection
- Clear error messages for configuration issues
- Graceful fallback for non-session servers

## Testing

Run the test suite to verify the framework:

```bash
bun run src/test/mcp-session-test.ts
```

The test covers:

- Session creation and validation
- Header extraction and sanitization
- Session discovery and lookup
- Connection with and without sessions
- Session cleanup and expiration

## Future Enhancements

### Planned Features

- Session persistence across restarts
- Session refresh mechanisms
- Multi-server session sharing
- Enhanced session analytics

### Extensibility

The framework is designed to support:

- Additional authentication methods
- Custom session validation logic
- Server-specific session requirements
- Advanced session management features

## Migration Guide

### For Existing MCP Servers

1. Update server configuration to include session requirements
2. Register with `MCPClient.registerServerConfig()`
3. Use `MCPClient.createConnection()` for connections

### For New MCP Servers

1. Extend `BaseMCPServer` for session-aware servers
2. Configure session requirements in server config
3. Implement session-specific validation logic

## Troubleshooting

### Common Issues

**Session not found**: Ensure headers are correctly formatted and include required session ID.

**Session validation failed**: Check session format and server configuration match.

**Connection timeout**: Verify server URL and session validity.

### Debug Logging

Enable debug logging to trace session operations:

```typescript
import { Log } from "./util/log"
Log.create({ service: "mcp.session", level: "debug" })
```

## API Reference

### SessionManager

- `createSession(serverName, headers)`: Create new session
- `validateSession(sessionId, serverName)`: Validate session
- `findSessionByHeaders(headers, serverName)`: Find existing session
- `invalidateSession(sessionId)`: Mark session as invalid
- `cleanupExpiredSessions()`: Remove expired sessions

### MCPClient

- `createConnection(options)`: Create session-aware connection
- `validateAndConnect(serverName, headers)`: Validate then connect
- `registerServerConfig(serverName, config)`: Register server config
- `listAvailableTools(connection)`: List server tools
- `callTool(connection, toolName, args)`: Call server tool

### BaseMCPServer

- `validateSession(request)`: Validate request session
- `listTools(sessionContext)`: List available tools
- `callTool(toolName, args, sessionContext)`: Execute tool with session
