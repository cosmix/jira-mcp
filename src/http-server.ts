#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { JiraApiService } from "./services/jira-api.js";
import { JiraServerApiService } from "./services/jira-server-api.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

declare module "bun" {
  interface Env {
    JIRA_API_TOKEN: string;
    JIRA_BASE_URL: string;
    JIRA_USER_EMAIL: string;
    JIRA_TYPE: string;
    JIRA_AUTH_TYPE: string;
    MCP_PORT: string;
    MCP_AUTH_TOKEN: string;
    MCP_ENABLE_SESSIONS: string;
    MCP_JSON_ONLY: string;
  }
}

const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_USER_EMAIL = process.env.JIRA_USER_EMAIL;
const JIRA_TYPE = (process.env.JIRA_TYPE === "server" ? "server" : "cloud") as
  | "cloud"
  | "server";
const JIRA_AUTH_TYPE = (process.env.JIRA_AUTH_TYPE === "bearer" ? "bearer" : "basic") as
  | "basic"
  | "bearer";

if (!JIRA_API_TOKEN || !JIRA_BASE_URL || !JIRA_USER_EMAIL) {
  throw new Error(
    "JIRA_API_TOKEN, JIRA_USER_EMAIL and JIRA_BASE_URL environment variables are required",
  );
}

class JiraHttpServer {
  private server: Server;
  private jiraApi: JiraApiService;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: "jira-mcp",
        version: "0.2.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    if (JIRA_TYPE === "server") {
      this.jiraApi = new JiraServerApiService(
        JIRA_BASE_URL,
        JIRA_USER_EMAIL,
        JIRA_API_TOKEN,
        JIRA_AUTH_TYPE,
      );
    } else {
      this.jiraApi = new JiraApiService(
        JIRA_BASE_URL,
        JIRA_USER_EMAIL,
        JIRA_API_TOKEN,
        JIRA_AUTH_TYPE,
      );
    }

    this.setupToolHandlers();

    this.server.onerror = (error) => {
      console.error("MCP Server error:", error);
    };
  }

  private setupToolHandlers() {
    // Copy all tool handlers from index.ts
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_issues",
          description: "Search JIRA issues using JQL",
          inputSchema: {
            type: "object",
            properties: {
              searchString: {
                type: "string",
                description: "JQL search string",
              },
            },
            required: ["searchString"],
            additionalProperties: false,
          },
        },
        {
          name: "get_epic_children",
          description:
            "Get all child issues in an epic including their comments",
          inputSchema: {
            type: "object",
            properties: {
              epicKey: {
                type: "string",
                description: "The key of the epic issue",
              },
            },
            required: ["epicKey"],
            additionalProperties: false,
          },
        },
        {
          name: "get_issue",
          description:
            "Get detailed information about a specific JIRA issue including comments",
          inputSchema: {
            type: "object",
            properties: {
              issueId: {
                type: "string",
                description: "The ID or key of the JIRA issue",
              },
            },
            required: ["issueId"],
            additionalProperties: false,
          },
        },
        {
          name: "create_issue",
          description: "Create a new JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              projectKey: {
                type: "string",
                description: "The project key where the issue will be created",
              },
              issueType: {
                type: "string",
                description:
                  'The type of issue to create (e.g., "Bug", "Story", "Task")',
              },
              summary: {
                type: "string",
                description: "The issue summary/title",
              },
              description: {
                type: "string",
                description: "The issue description",
              },
              fields: {
                type: "object",
                description: "Additional fields to set on the issue",
                additionalProperties: true,
              },
            },
            required: ["projectKey", "issueType", "summary"],
            additionalProperties: false,
          },
        },
        {
          name: "update_issue",
          description: "Update an existing JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to update",
              },
              fields: {
                type: "object",
                description: "Fields to update on the issue",
                additionalProperties: true,
              },
            },
            required: ["issueKey", "fields"],
            additionalProperties: false,
          },
        },
        {
          name: "get_transitions",
          description: "Get available status transitions for a JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to get transitions for",
              },
            },
            required: ["issueKey"],
            additionalProperties: false,
          },
        },
        {
          name: "transition_issue",
          description:
            "Change the status of a JIRA issue by performing a transition",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to transition",
              },
              transitionId: {
                type: "string",
                description: "The ID of the transition to perform",
              },
              comment: {
                type: "string",
                description: "Optional comment to add with the transition",
              },
            },
            required: ["issueKey", "transitionId"],
            additionalProperties: false,
          },
        },
        {
          name: "add_attachment",
          description: "Add a file attachment to a JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to add attachment to",
              },
              fileContent: {
                type: "string",
                description: "Base64 encoded content of the file",
              },
              filename: {
                type: "string",
                description: "Name of the file to be attached",
              },
            },
            required: ["issueKey", "fileContent", "filename"],
            additionalProperties: false,
          },
        },
        {
          name: "add_comment",
          description: "Add a comment to a JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              issueIdOrKey: {
                type: "string",
                description: "The ID or key of the issue to add the comment to",
              },
              body: {
                type: "string",
                description: "The content of the comment (plain text)",
              },
            },
            required: ["issueIdOrKey", "body"],
            additionalProperties: false,
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const args = request.params.arguments as Record<string, any>;

        switch (request.params.name) {
          case "search_issues": {
            if (!args.searchString || typeof args.searchString !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Search string is required",
              );
            }
            const response = await this.jiraApi.searchIssues(args.searchString);
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "get_epic_children": {
            if (!args.epicKey || typeof args.epicKey !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Epic key is required",
              );
            }
            const response = await this.jiraApi.getEpicChildren(args.epicKey);
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "get_issue": {
            if (!args.issueId || typeof args.issueId !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Issue ID is required",
              );
            }
            const response = await this.jiraApi.getIssueWithComments(
              args.issueId,
            );
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "create_issue": {
            if (
              !args.projectKey ||
              typeof args.projectKey !== "string" ||
              !args.issueType ||
              typeof args.issueType !== "string" ||
              !args.summary ||
              typeof args.summary !== "string"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "projectKey, issueType, and summary are required",
              );
            }
            const response = await this.jiraApi.createIssue(
              args.projectKey,
              args.issueType,
              args.summary,
              args.description as string | undefined,
              args.fields as Record<string, any> | undefined,
            );
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "update_issue": {
            if (
              !args.issueKey ||
              typeof args.issueKey !== "string" ||
              !args.fields ||
              typeof args.fields !== "object"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueKey and fields object are required",
              );
            }
            await this.jiraApi.updateIssue(args.issueKey, args.fields);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { message: `Issue ${args.issueKey} updated successfully` },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "get_transitions": {
            if (!args.issueKey || typeof args.issueKey !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Issue key is required",
              );
            }
            const response = await this.jiraApi.getTransitions(args.issueKey);
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "transition_issue": {
            if (
              !args.issueKey ||
              typeof args.issueKey !== "string" ||
              !args.transitionId ||
              typeof args.transitionId !== "string"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueKey and transitionId are required",
              );
            }
            await this.jiraApi.transitionIssue(
              args.issueKey,
              args.transitionId,
              args.comment as string | undefined,
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      message: `Issue ${args.issueKey} transitioned successfully${args.comment ? " with comment" : ""}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "add_attachment": {
            if (
              !args.issueKey ||
              typeof args.issueKey !== "string" ||
              !args.fileContent ||
              typeof args.fileContent !== "string" ||
              !args.filename ||
              typeof args.filename !== "string"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueKey, fileContent, and filename are required",
              );
            }
            const fileBuffer = Buffer.from(args.fileContent, "base64");
            const result = await this.jiraApi.addAttachment(
              args.issueKey,
              fileBuffer,
              args.filename,
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      message: `File ${args.filename} attached successfully to issue ${args.issueKey}`,
                      attachmentId: result.id,
                      filename: result.filename,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "add_comment": {
            if (
              !args.issueIdOrKey ||
              typeof args.issueIdOrKey !== "string" ||
              !args.body ||
              typeof args.body !== "string"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueIdOrKey and body are required",
              );
            }
            const response = await this.jiraApi.addCommentToIssue(
              args.issueIdOrKey,
              args.body,
            );
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`,
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : "Unknown error occurred",
        );
      }
    });
  }

  private convertBunRequestToNode(
    req: Request,
    _body: any
  ): { nodeReq: IncomingMessage; nodeRes: ServerResponse } {
    // Create a mock IncomingMessage
    const nodeReq = new Readable({
      read() {},
    }) as any as IncomingMessage;

    // Set up headers
    const headers: Record<string, string | string[]> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    nodeReq.headers = headers;
    nodeReq.method = req.method;
    nodeReq.url = new URL(req.url).pathname;

    // Create a mock ServerResponse
    let statusCode = 200;
    const responseHeaders: Record<string, string | string[]> = {};
    let responseData: any[] = [];

    const nodeRes = {
      statusCode,
      setHeader(name: string, value: string | string[]) {
        responseHeaders[name.toLowerCase()] = value;
      },
      writeHead(code: number, headers?: any) {
        statusCode = code;
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            this.setHeader(key, value as string);
          });
        }
        return this;
      },
      write(chunk: any) {
        responseData.push(chunk);
        return true;
      },
      end(chunk?: any) {
        if (chunk !== undefined) {
          responseData.push(chunk);
        }
        // This will be handled by the caller
        return this;
      },
      on(_event: string, _listener: Function) {
        // Basic event emitter mock
        return this;
      },
      once(_event: string, _listener: Function) {
        return this;
      },
      emit(_event: string, ..._args: any[]) {
        return true;
      },
      removeListener(_event: string, _listener: Function) {
        return this;
      },
      headersSent: false,
      getHeaders() {
        return responseHeaders;
      },
      getResponseData() {
        return responseData;
      },
      getStatusCode() {
        return statusCode;
      },
    } as any as ServerResponse & {
      getResponseData(): any[];
      getStatusCode(): number;
    };

    return { nodeReq, nodeRes };
  }

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Handle OAuth metadata endpoints
    if (url.pathname === "/.well-known/oauth-protected-resource" && process.env.MCP_OAUTH_ENABLED === "true") {
      // OAuth 2.0 Protected Resource Metadata
      const metadata = {
        resource: `${url.origin}/mcp`,
        scopes_supported: ["mcp:tools", "mcp:read", "mcp:write"],
        bearer_methods_supported: ["header"],
        resource_documentation: process.env.MCP_OAUTH_DOCS_URL || `${url.origin}/docs`,
        resource_name: "JIRA MCP Server",
        ...(process.env.MCP_OAUTH_ISSUER && {
          authorization_servers: [process.env.MCP_OAUTH_ISSUER],
        }),
      };

      return new Response(JSON.stringify(metadata, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Only handle /mcp endpoint for main functionality
    if (url.pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Mcp-Session-Id, Accept",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // OAuth2-compatible authentication
    if (process.env.MCP_OAUTH_ENABLED === "true" || process.env.MCP_AUTH_TOKEN) {
      const auth = req.headers.get("Authorization");
      
      if (!auth?.startsWith("Bearer ")) {
        const wwwAuthenticate = process.env.MCP_OAUTH_ENABLED === "true"
          ? `Bearer realm="${url.origin}", scope="mcp:*"`
          : 'Bearer';
        
        return new Response("Unauthorized", {
          status: 401,
          headers: {
            ...corsHeaders,
            "WWW-Authenticate": wwwAuthenticate,
          },
        });
      }

      const token = auth.slice(7);
      
      // OAuth2 token verification
      if (process.env.MCP_OAUTH_ENABLED === "true") {
        // If using external OAuth provider, verify token
        if (process.env.MCP_OAUTH_INTROSPECTION_URL) {
          try {
            const introspectionResponse = await fetch(
              process.env.MCP_OAUTH_INTROSPECTION_URL,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  // Add client credentials if required by the OAuth provider
                  ...(process.env.MCP_OAUTH_CLIENT_ID && process.env.MCP_OAUTH_CLIENT_SECRET
                    ? {
                        Authorization: `Basic ${Buffer.from(
                          `${process.env.MCP_OAUTH_CLIENT_ID}:${process.env.MCP_OAUTH_CLIENT_SECRET}`
                        ).toString("base64")}`,
                      }
                    : {}),
                },
                body: new URLSearchParams({
                  token,
                  token_type_hint: "access_token",
                }),
              }
            );

            if (!introspectionResponse.ok) {
              throw new Error("Token introspection failed");
            }

            const tokenInfo = await introspectionResponse.json();
            
            if (!tokenInfo.active) {
              return new Response("Invalid or expired token", {
                status: 401,
                headers: {
                  ...corsHeaders,
                  "WWW-Authenticate": `Bearer error="invalid_token"`,
                },
              });
            }

            // Optionally check scopes
            if (process.env.MCP_OAUTH_REQUIRED_SCOPE) {
              const scopes = tokenInfo.scope?.split(" ") || [];
              if (!scopes.includes(process.env.MCP_OAUTH_REQUIRED_SCOPE)) {
                return new Response("Insufficient scope", {
                  status: 403,
                  headers: {
                    ...corsHeaders,
                    "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${process.env.MCP_OAUTH_REQUIRED_SCOPE}"`,
                  },
                });
              }
            }
          } catch (error) {
            console.error("OAuth token verification failed:", error);
            return new Response("Authentication failed", {
              status: 401,
              headers: {
                ...corsHeaders,
                "WWW-Authenticate": `Bearer error="invalid_token"`,
              },
            });
          }
        }
      } else if (process.env.MCP_AUTH_TOKEN && token !== process.env.MCP_AUTH_TOKEN) {
        // Simple bearer token check
        return new Response("Unauthorized", {
          status: 401,
          headers: {
            ...corsHeaders,
            "WWW-Authenticate": "Bearer",
          },
        });
      }
    }

    try {
      // Parse body for POST requests
      let body = null;
      if (req.method === "POST") {
        body = await req.json();
      }

      const sessionId = req.headers.get("mcp-session-id");
      let transport: StreamableHTTPServerTransport;

      // Check if this is an initialization request
      const isInitRequest = body?.method === "initialize";

      if (sessionId && this.transports.has(sessionId)) {
        // Use existing transport for this session
        transport = this.transports.get(sessionId)!;
      } else if (isInitRequest || process.env.MCP_ENABLE_SESSIONS === "false") {
        // Create new transport
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator:
            process.env.MCP_ENABLE_SESSIONS === "false"
              ? undefined
              : () => crypto.randomUUID(),
          enableJsonResponse: process.env.MCP_JSON_ONLY === "true",
          onsessioninitialized: (sessionId) => {
            console.log(`Session initialized: ${sessionId}`);
            if (sessionId) {
              this.transports.set(sessionId, transport);
            }
          },
          onsessionclosed: (sessionId) => {
            console.log(`Session closed: ${sessionId}`);
            this.transports.delete(sessionId);
          },
        });

        // Connect transport to server
        await this.server.connect(transport);

        // Set up cleanup
        transport.onclose = () => {
          const sid = (transport as any).sessionId;
          if (sid && this.transports.has(sid)) {
            this.transports.delete(sid);
          }
        };
      } else {
        // No session ID and not an init request
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid session ID provided",
            },
            id: null,
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Convert Bun request/response to Node.js format
      const { nodeReq, nodeRes } = this.convertBunRequestToNode(req, body);

      // Handle the request
      await transport.handleRequest(nodeReq, nodeRes, body);

      // Extract response data
      const responseData = (nodeRes as any).getResponseData();
      const statusCode = (nodeRes as any).getStatusCode();
      const headers = nodeRes.getHeaders() as Record<string, string | string[]>;

      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers[key] = value;
      });

      // Handle SSE responses
      if (headers["content-type"] === "text/event-stream") {
        // For SSE, we need to return a streaming response
        const stream = new ReadableStream({
          start(controller) {
            responseData.forEach((chunk: any) => {
              controller.enqueue(
                typeof chunk === "string"
                  ? new TextEncoder().encode(chunk)
                  : chunk
              );
            });
          },
        });

        return new Response(stream, {
          status: statusCode,
          headers: headers as HeadersInit,
        });
      }

      // Handle JSON responses
      const responseBody = responseData.join("");
      return new Response(responseBody || null, {
        status: statusCode,
        headers: headers as HeadersInit,
      });
    } catch (error) {
      console.error("Error handling request:", error);
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  async start() {
    const port = parseInt(process.env.MCP_PORT || "3000", 10);

    Bun.serve({
      port,
      fetch: (req) => this.handleRequest(req),
    });

    console.log(`JIRA MCP HTTP Server listening on port ${port}`);
    console.log(`Endpoint: http://localhost:${port}/mcp`);
    
    if (process.env.MCP_OAUTH_ENABLED === "true") {
      console.log(`Authentication: OAuth2 enabled`);
      console.log(`  - Metadata: http://localhost:${port}/.well-known/oauth-protected-resource`);
      if (process.env.MCP_OAUTH_INTROSPECTION_URL) {
        console.log(`  - Token verification: ${process.env.MCP_OAUTH_INTROSPECTION_URL}`);
      }
      if (process.env.MCP_OAUTH_ISSUER) {
        console.log(`  - Authorization server: ${process.env.MCP_OAUTH_ISSUER}`);
      }
      if (process.env.MCP_OAUTH_REQUIRED_SCOPE) {
        console.log(`  - Required scope: ${process.env.MCP_OAUTH_REQUIRED_SCOPE}`);
      }
    } else if (process.env.MCP_AUTH_TOKEN) {
      console.log(`Authentication: Bearer token`);
    } else {
      console.log(`Authentication: Disabled`);
    }
    
    console.log(
      `Sessions: ${process.env.MCP_ENABLE_SESSIONS !== "false" ? "Enabled" : "Disabled"}`
    );
    console.log(
      `Response mode: ${process.env.MCP_JSON_ONLY === "true" ? "JSON only" : "JSON/SSE (automatic)"}`
    );
  }
}

// Handle shutdown gracefully
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  process.exit(0);
});

// Start the server
const server = new JiraHttpServer();
server.start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});