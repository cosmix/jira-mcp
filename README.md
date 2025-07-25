# JIRA MCP Server

A Model Context Protocol (MCP) server implementation that provides access to JIRA data with relationship tracking, optimized data payloads, and data cleaning for AI context windows.

ℹ️ There is a separate MCP server [for Confluence](https://github.com/cosmix/confluence-mcp)

---

## Jira Cloud & Jira Server (Data Center) Support

This MCP server supports both **Jira Cloud** and **Jira Server (Data Center)** instances. You can select which type to use by setting the `JIRA_TYPE` environment variable:

- `cloud` (default): For Jira Cloud (Atlassian-hosted)
- `server`: For Jira Server/Data Center (self-hosted)

The server will automatically use the correct API version and authentication method for the selected type.

---

## Features

- Search JIRA issues using JQL (maximum 50 results per request)
- Retrieve epic children with comment history and optimized payloads (maximum 100 issues per request)
- Get detailed issue information including comments and related issues
- Create, update, and manage JIRA issues
- Add comments to issues
- Extract issue mentions from Atlassian Document Format
- Track issue relationships (mentions, links, parent/child, epics)
- Clean and transform rich JIRA content for AI context efficiency
- Support for file attachments with secure multipart upload handling
- **Supports both Jira Cloud and Jira Server (Data Center) APIs**

## Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or higher)
- JIRA account with API access

## Environment Variables

```bash
JIRA_API_TOKEN=your_api_token            # API token for Cloud, PAT or password for Server/DC
JIRA_BASE_URL=your_jira_instance_url     # e.g., https://your-domain.atlassian.net
JIRA_USER_EMAIL=your_email               # Your Jira account email
JIRA_TYPE=cloud                          # 'cloud' or 'server' (optional, defaults to 'cloud')
JIRA_AUTH_TYPE=basic                     # 'basic' or 'bearer' (optional, defaults to 'basic')
```

### Authentication Methods

- **Jira Cloud**: Use API tokens with Basic authentication
  - Create an API token at: <https://id.atlassian.com/manage-profile/security/api-tokens>
  - Set `JIRA_AUTH_TYPE=basic` (default)
  
- **Jira Server/Data Center**:
  - **Basic Auth**: Use username/password or API tokens
    - Set `JIRA_AUTH_TYPE=basic` (default)
  - **Bearer Auth**: Use Personal Access Tokens (PATs) - available in Data Center 8.14.0+
    - Create a PAT in your profile settings
    - Set `JIRA_AUTH_TYPE=bearer`
    - Use the PAT as your `JIRA_API_TOKEN`

## Installation & Setup

### 1. Clone the repository

```bash
git clone [repository-url]
cd jira-mcp
```

### 2. Install dependencies and build

```bash
bun install
bun run build
```

### 3. Configure the MCP server

Edit the appropriate configuration file:

**macOS:**

- Cline: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:**

- Cline: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- Claude Desktop: `%APPDATA%\Claude Desktop\claude_desktop_config.json`

**Linux:**

- Cline: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- Claude Desktop: _sadly doesn't exist yet_

Add the following configuration under the `mcpServers` object:

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp/build/index.js"],
      "env": {
        "JIRA_API_TOKEN": "your_api_token",
        "JIRA_BASE_URL": "your_jira_instance_url",
        "JIRA_USER_EMAIL": "your_email",
        "JIRA_TYPE": "cloud",
        "JIRA_AUTH_TYPE": "basic"
      }
    }
  }
}
```

### 4. Restart the MCP server

Within Cline's MCP settings, restart the MCP server. Restart Claude Desktop to load the new MCP server.

## Development

Run tests:

```bash
bun test
```

Watch mode for development:

```bash
bun run dev
```

To rebuild after changes:

```bash
bun run build
```

## Available MCP Tools

### search_issues

Search JIRA issues using JQL. Returns up to 50 results per request.

Input Schema:

```typescript
{
  searchString: string; // JQL search string
}
```

### get_epic_children

Get all child issues in an epic including their comments and relationship data. Limited to 100 issues per request.

Input Schema:

```typescript
{
  epicKey: string; // The key of the epic issue
}
```

### get_issue

Get detailed information about a specific JIRA issue including comments and all relationships.

Input Schema:

```typescript
{
  issueId: string; // The ID or key of the JIRA issue
}
```

### create_issue

Create a new JIRA issue with specified fields.

Input Schema:

```typescript
{
  projectKey: string, // The project key where the issue will be created
  issueType: string, // The type of issue (e.g., "Bug", "Story", "Task")
  summary: string, // The issue summary/title
  description?: string, // Optional issue description
  fields?: { // Optional additional fields
    [key: string]: any
  }
}
```

### update_issue

Update fields of an existing JIRA issue.

Input Schema:

```typescript
{
  issueKey: string, // The key of the issue to update
  fields: { // Fields to update
    [key: string]: any
  }
}
```

### add_attachment

Add a file attachment to a JIRA issue.

Input Schema:

```typescript
{
  issueKey: string, // The key of the issue
  fileContent: string, // Base64 encoded file content
  filename: string // Name of the file to be attached
}
```

### add_comment

Add a comment to a JIRA issue. Accepts plain text and converts it to the required Atlassian Document Format internally.

Input Schema:

```typescript
{
  issueIdOrKey: string, // The ID or key of the issue to add the comment to
  body: string // The content of the comment (plain text)
}
```

## Data Cleaning Features

- Extracts text from Atlassian Document Format
- Tracks issue mentions in descriptions and comments
- Maintains formal issue links with relationship types
- Preserves parent/child relationships
- Tracks epic associations
- Includes comment history with author information
- Removes unnecessary metadata from responses
- Recursively processes content nodes for mentions
- Deduplicates issue mentions

## Technical Details

- Built with TypeScript in strict mode
- Uses Bun runtime for improved performance
- Vite for optimized builds
- Uses JIRA REST API v3 (Cloud) or v2 (Server/Data Center)
- Supports multiple authentication methods:
  - Basic authentication with API tokens or username/password
  - Bearer authentication with Personal Access Tokens (PATs)
- Batched API requests for related data
- Optimized response payloads for AI context windows
- Efficient transformation of complex Atlassian structures
- Robust error handling
- Rate limiting considerations
- Maximum limits:
  - Search results: 50 issues per request
  - Epic children: 100 issues per request
- Support for multipart form data for secure file attachments
- Automatic content type detection and validation

## Error Handling

The server implements a comprehensive error handling strategy:

- Network error detection and appropriate messaging
- HTTP status code handling (especially 404 for issues)
- Detailed error messages with status codes
- Error details logging to console
- Input validation for all parameters
- Safe error propagation through MCP protocol
- Specialized handling for common JIRA API errors
- Base64 validation for attachments
- Multipart request failure handling
- Rate limit detection
- Attachment parameter validation

## LICENCE

This project is licensed under the MIT License - see the [LICENCE](LICENCE) file for details.
