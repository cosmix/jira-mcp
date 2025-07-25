# OAuth2 Setup Guide for JIRA MCP Server

This guide explains how to configure OAuth2 authentication for the JIRA MCP HTTP server.

## Overview

The JIRA MCP server supports standard OAuth2 bearer token authentication, allowing you to integrate with any OAuth2 provider. This enables secure, multi-user access to the MCP server.

## How It Works

1. **Client obtains token**: Users authenticate with your OAuth2 provider and receive an access token
2. **Client sends token**: The token is included in the `Authorization: Bearer <token>` header
3. **Server validates token**: The MCP server validates the token using the provider's introspection endpoint
4. **Access granted/denied**: Based on token validity and scopes

## Configuration

### Required Environment Variables

```bash
# Enable OAuth2 mode
export MCP_OAUTH_ENABLED=true

# Your OAuth2 provider's token introspection endpoint
export MCP_OAUTH_INTROSPECTION_URL="https://your-provider.com/oauth2/introspect"
```

### Optional Environment Variables

```bash
# OAuth2 authorization server (for metadata)
export MCP_OAUTH_ISSUER="https://your-provider.com"

# Client credentials (if your introspection endpoint requires authentication)
export MCP_OAUTH_CLIENT_ID="your-client-id"
export MCP_OAUTH_CLIENT_SECRET="your-client-secret"

# Required scope (if you want to enforce specific scopes)
export MCP_OAUTH_REQUIRED_SCOPE="mcp:tools"

# Documentation URL (shown in OAuth metadata)
export MCP_OAUTH_DOCS_URL="https://your-docs.com/mcp"
```

## Provider-Specific Setup

### Auth0

1. Create an API in Auth0 Dashboard
2. Note your domain and API identifier
3. Configure:
```bash
export MCP_OAUTH_ISSUER="https://YOUR_DOMAIN.auth0.com/"
export MCP_OAUTH_INTROSPECTION_URL="https://YOUR_DOMAIN.auth0.com/oauth/introspect"
export MCP_OAUTH_CLIENT_ID="YOUR_API_IDENTIFIER"
export MCP_OAUTH_CLIENT_SECRET="YOUR_API_SECRET"
```

### Keycloak

1. Create a client in Keycloak
2. Enable "Service Accounts Enabled" for introspection
3. Configure:
```bash
export MCP_OAUTH_ISSUER="https://YOUR_KEYCLOAK/realms/YOUR_REALM"
export MCP_OAUTH_INTROSPECTION_URL="https://YOUR_KEYCLOAK/realms/YOUR_REALM/protocol/openid-connect/token/introspect"
export MCP_OAUTH_CLIENT_ID="YOUR_CLIENT_ID"
export MCP_OAUTH_CLIENT_SECRET="YOUR_CLIENT_SECRET"
```

### Okta

1. Create an authorization server or use default
2. Create a client application
3. Configure:
```bash
export MCP_OAUTH_ISSUER="https://YOUR_DOMAIN.okta.com/oauth2/default"
export MCP_OAUTH_INTROSPECTION_URL="https://YOUR_DOMAIN.okta.com/oauth2/default/v1/introspect"
export MCP_OAUTH_CLIENT_ID="YOUR_CLIENT_ID"
export MCP_OAUTH_CLIENT_SECRET="YOUR_CLIENT_SECRET"
```

### Google Identity Platform

1. Create OAuth2 credentials in Google Cloud Console
2. Configure:
```bash
export MCP_OAUTH_ISSUER="https://accounts.google.com"
export MCP_OAUTH_INTROSPECTION_URL="https://oauth2.googleapis.com/tokeninfo"
# Note: Google uses a different introspection format, may need custom handling
```

## Client Configuration

### For MCP Clients

Configure your MCP client to include the OAuth2 token:

```json
{
  "mcpServers": {
    "jira-oauth": {
      "url": "https://your-server.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

### Obtaining Tokens

Your users will need to:
1. Authenticate with your OAuth2 provider
2. Obtain an access token with appropriate scopes
3. Include the token in their MCP client configuration

## OAuth2 Metadata

The server exposes OAuth2 Protected Resource Metadata at:
```
https://your-server.com/.well-known/oauth-protected-resource
```

This endpoint provides:
- Supported scopes
- Bearer token methods
- Resource documentation
- Associated authorization servers

## Security Scopes

The server recognizes these scopes:
- `mcp:tools` - Access to execute JIRA tools
- `mcp:read` - Read-only access
- `mcp:write` - Write access

Configure `MCP_OAUTH_REQUIRED_SCOPE` to enforce specific scopes.

## Troubleshooting

### Token Validation Fails
- Check the introspection URL is correct
- Verify client credentials if required
- Ensure the token is active and not expired
- Check token scopes match requirements

### 401 Unauthorized
- Verify `Authorization: Bearer <token>` header is present
- Check token format is correct
- Ensure OAuth2 is enabled (`MCP_OAUTH_ENABLED=true`)

### 403 Forbidden
- Token is valid but lacks required scope
- Check `MCP_OAUTH_REQUIRED_SCOPE` setting

## Example: Complete Setup with Auth0

```bash
# 1. Set JIRA credentials
export JIRA_API_TOKEN="your-jira-token"
export JIRA_BASE_URL="https://yourcompany.atlassian.net"
export JIRA_USER_EMAIL="you@company.com"

# 2. Configure OAuth2
export MCP_OAUTH_ENABLED=true
export MCP_OAUTH_ISSUER="https://yourcompany.auth0.com/"
export MCP_OAUTH_INTROSPECTION_URL="https://yourcompany.auth0.com/oauth/introspect"
export MCP_OAUTH_CLIENT_ID="your-api-identifier"
export MCP_OAUTH_CLIENT_SECRET="your-api-secret"
export MCP_OAUTH_REQUIRED_SCOPE="mcp:tools"

# 3. Start the server
bun run start:http
```

## Best Practices

1. **Always use HTTPS** in production
2. **Rotate client secrets** regularly
3. **Use short-lived tokens** (1 hour or less)
4. **Implement refresh tokens** for better UX
5. **Monitor token usage** for anomalies
6. **Use scope restrictions** to limit access
7. **Enable rate limiting** at proxy level

## Next Steps

- Set up HTTPS reverse proxy (nginx/Caddy)
- Configure your OAuth2 provider
- Test with a sample client
- Monitor authentication logs
- Implement token refresh flow