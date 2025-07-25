# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tools and Workflow

- Use `fd` instead of `find`. Use `rg` instead of `grep`. Fallback to the originals only if the new tools fail for whatever reason.

## Common Development Commands

- Build stdio version: `bun run build`
- Build HTTP version: `bun run build:http`
- Build both versions: `bun run build:all`
- Run tests: `bun test`
- Watch tests: `bun test:watch`
- Run a single test file: `bun test src/services/__tests__/jira-api.test.ts`
- Development mode: `bun run dev`
- Start stdio server: `bun start` (requires build first)
- Start HTTP server: `bun start:http` (requires build:http first)

## Architecture Overview

This is a Model Context Protocol (MCP) server that provides access to JIRA data with:

- Support for both Jira Cloud and Jira Server/Data Center instances
- Relationship tracking between issues (mentions, links, parent/child, epics)
- Optimized data payloads for AI context windows
- Rich content cleaning and transformation

### Key Components

1. **Entry Points**:
   - `src/index.ts` - Stdio transport for local use (default)
   - `src/http-server.ts` - HTTP transport with streaming support for remote access

2. **Transport Layer**:
   - `StdioServerTransport` - For local CLI integration
   - `StreamableHTTPServerTransport` - For HTTP with SSE streaming support
   - Automatic protocol selection based on client needs (JSON or SSE)

3. **Service Layer**:
   - `JiraApiService` - Handles Jira Cloud API v3 interactions
   - `JiraServerApiService` - Handles Jira Server/Data Center API v2 interactions
   - Both support Basic and Bearer authentication methods

4. **Type System** (`src/types/jira.ts`):
   - Clean data models optimized for AI consumption
   - Atlassian Document Format (ADF) handling
   - Relationship tracking interfaces

## Implementation Details

### Authentication

- **Basic Auth**: Used with API tokens (Cloud) or username/password (Server)
- **Bearer Auth**: Used with Personal Access Tokens (Server/DC 8.14.0+)
- Auth type is determined by `JIRA_AUTH_TYPE` environment variable

### Data Processing

- Extracts text from Atlassian Document Format
- Tracks issue mentions in descriptions and comments
- Deduplicates and categorizes relationships
- Removes unnecessary metadata for efficient context usage

### API Limits

- Search results: Maximum 50 issues per request
- Epic children: Maximum 100 issues per request
- File attachments: Multipart form data with Base64 encoding

### Error Handling

- Comprehensive error messages with HTTP status codes
- Specific JIRA API error parsing
- Network error detection
- Input validation for all tool parameters

## Environment Variables

### JIRA Configuration (Required)

- `JIRA_API_TOKEN` - API token or password
- `JIRA_BASE_URL` - Instance URL
- `JIRA_USER_EMAIL` - User email

### JIRA Options

- `JIRA_TYPE` - 'cloud' (default) or 'server'
- `JIRA_AUTH_TYPE` - 'basic' (default) or 'bearer'

### HTTP Server Options

- `MCP_PORT` - HTTP server port (default: 3000)
- `MCP_ENABLE_SESSIONS` - Enable session management (default: true)
- `MCP_JSON_ONLY` - Force JSON-only responses, no SSE (default: false)

### HTTP Authentication Options

#### Simple Bearer Token

- `MCP_AUTH_TOKEN` - Static bearer token for basic authentication

#### OAuth2 Authentication (Recommended for production)

- `MCP_OAUTH_ENABLED` - Enable OAuth2 authentication mode
- `MCP_OAUTH_ISSUER` - OAuth2 authorization server URL
- `MCP_OAUTH_INTROSPECTION_URL` - Token introspection endpoint
- `MCP_OAUTH_CLIENT_ID` - Client ID for introspection (if required)
- `MCP_OAUTH_CLIENT_SECRET` - Client secret for introspection (if required)
- `MCP_OAUTH_REQUIRED_SCOPE` - Required OAuth2 scope (optional)
- `MCP_OAUTH_DOCS_URL` - Documentation URL for OAuth metadata (optional)

## HTTP Transport Details

The HTTP server uses Bun's native `Bun.serve()` API to avoid additional dependencies. It implements the MCP Streamable HTTP specification:

### Endpoints

- **POST /mcp** - Handles JSON-RPC messages
- **GET /mcp** - Opens SSE stream for server-initiated messages
- **DELETE /mcp** - Terminates session
- **GET /.well-known/oauth-protected-resource** - OAuth2 metadata (when OAuth2 enabled)

### HTTP Authentication

The server supports two authentication modes:

1. **Simple Bearer Token**: Set `MCP_AUTH_TOKEN` for static token authentication
2. **OAuth2**: Full OAuth2 bearer token authentication with token introspection

When OAuth2 is enabled:

- Tokens are validated via the configured introspection endpoint
- Optional scope enforcement with `MCP_OAUTH_REQUIRED_SCOPE`
- Standard OAuth2 error responses (401/403 with WWW-Authenticate headers)
- OAuth2 Protected Resource Metadata endpoint for discovery

### Response Modes

The transport automatically chooses between JSON responses and SSE streaming based on the communication needs. Session management allows multiple concurrent clients with isolated state.

### Security Notes

- CORS is enabled for browser-based clients
- Always use HTTPS in production (configure reverse proxy)
- OAuth2 is recommended for multi-user deployments
- See `docs/oauth2-setup.md` for detailed OAuth2 configuration
