import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { JiraApiService } from "../jira-api.js";

const mockFormattedDescription = {
  fields: {
    description: {
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "As a ",
            },
            {
              type: "text",
              text: "user",
              marks: [{ type: "em" }],
            },
            {
              type: "text",
              text: " I want to see formatted text",
            },
          ],
        },
      ],
    },
  },
};

describe("JiraApiService", () => {
  describe("cleanIssue", () => {
    test("should properly handle formatted text in description", () => {
      const service = new JiraApiService(
        "http://test",
        "test@test.com",
        "token",
      );
      const result = (service as any).cleanIssue(mockFormattedDescription);
      expect(result.description).toBe("As a user I want to see formatted text");
    });
  });

  const baseUrl = "https://your-domain.atlassian.net";
  const apiToken = "test-token";
  const email = "user@domain.net";
  let service: JiraApiService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    service = new JiraApiService(baseUrl, email, apiToken);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    test("should set up fetch with correct base URL and basic auth header", async () => {
      // Mock fetch to verify headers
      const mockFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const url = input.toString();
        expect(url.startsWith(baseUrl)).toBe(true);
        const headers = init?.headers as Headers;
        expect(headers.get("Authorization")).toBe(
          `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`,
        );
        expect(headers.get("Content-Type")).toBe("application/json");
        return new Response(JSON.stringify({ issues: [] }));
      };
      mockFetch.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch;

      await service.searchIssues("project = TEST");
    });

    test("should set up fetch with bearer auth header when authType is bearer", async () => {
      const bearerService = new JiraApiService(baseUrl, email, apiToken, 'bearer');
      
      // Mock fetch to verify headers
      const mockFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const url = input.toString();
        expect(url.startsWith(baseUrl)).toBe(true);
        const headers = init?.headers as Headers;
        expect(headers.get("Authorization")).toBe(`Bearer ${apiToken}`);
        expect(headers.get("Content-Type")).toBe("application/json");
        return new Response(JSON.stringify({ issues: [] }));
      };
      mockFetch.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch;

      await bearerService.searchIssues("project = TEST");
    });
  });

  describe("searchIssues", () => {
    test("should make GET request to correct endpoint and clean response", async () => {
      const mockResponse = {
        issues: [
          {
            id: "1",
            key: "TEST-1",
            fields: {
              summary: "Test Issue",
              status: { name: "Open" },
              created: "2024-01-01T00:00:00.000Z",
              updated: "2024-01-01T00:00:00.000Z",
              parent: {
                id: "parent-1",
                key: "TEST-PARENT",
                fields: {
                  summary: "Parent Issue",
                },
              },
              subtasks: [
                {
                  id: "child-1",
                  key: "TEST-CHILD",
                  fields: {
                    summary: "Child Issue",
                  },
                },
              ],
              customfield_10014: "EPIC-1",
              description: {
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Test Description with mention of TEST-2",
                      },
                      {
                        type: "inlineCard",
                        attrs: {
                          url: "/browse/TEST-3",
                        },
                      },
                    ],
                  },
                ],
              },
              issuelinks: [
                {
                  type: {
                    inward: "is blocked by",
                  },
                  inwardIssue: {
                    key: "TEST-4",
                    fields: {
                      summary: "Blocking Issue",
                    },
                  },
                },
              ],
            },
          },
        ],
        total: 1,
      };

      const expectedResponse = {
        total: 1,
        issues: [
          {
            id: "1",
            key: "TEST-1",
            summary: "Test Issue",
            description: "Test Description with mention of TEST-2",
            status: "Open",
            created: "2024-01-01T00:00:00.000Z",
            updated: "2024-01-01T00:00:00.000Z",
            parent: {
              id: "parent-1",
              key: "TEST-PARENT",
              summary: "Parent Issue",
            },
            children: [
              {
                id: "child-1",
                key: "TEST-CHILD",
                summary: "Child Issue",
              },
            ],
            epicLink: {
              id: "EPIC-1",
              key: "EPIC-1",
              summary: undefined,
            },
            relatedIssues: [
              {
                key: "TEST-2",
                type: "mention" as const,
                source: "description" as const,
              },
              {
                key: "TEST-3",
                type: "mention" as const,
                source: "description" as const,
              },
              {
                key: "TEST-4",
                summary: "Blocking Issue",
                type: "link" as const,
                relationship: "is blocked by",
                source: "description" as const,
              },
            ],
          },
        ],
      };

      const mockFetch1 = async () => new Response(JSON.stringify(mockResponse));
      mockFetch1.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch1;

      const result = await service.searchIssues("project = TEST");
      expect(result).toEqual(expectedResponse);
    });

    test("should handle error responses", async () => {
      const mockFetch2 = async () =>
        new Response(
          JSON.stringify({ message: "You do not have permission" }),
          { status: 403 },
        );
      mockFetch2.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch2;

      await expect(service.searchIssues("project = TEST")).rejects.toThrow(
        "JIRA API Error: You do not have permission",
      );
    });
  });

  describe("getEpicChildren", () => {
    const epicKey = "TEST-1";
    const mockResponse = {
      issues: [
        {
          id: "2",
          key: "TEST-2",
          fields: {
            summary: "Child Issue",
            description: {
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Child Description",
                    },
                  ],
                },
              ],
            },
            status: { name: "Open" },
            created: "2024-01-01T00:00:00.000Z",
            updated: "2024-01-01T00:00:00.000Z",
          },
        },
      ],
      total: 1,
    };

    const mockComments = {
      comments: [
        {
          id: "1",
          body: {
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Test Comment mentioning TEST-5",
                  },
                  {
                    type: "inlineCard",
                    attrs: {
                      url: "/browse/TEST-6",
                    },
                  },
                ],
              },
            ],
          },
          author: { displayName: "Test User" },
          created: "2024-01-01T00:00:00.000Z",
          updated: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    test("should fetch epic children with comments", async () => {
      let fetchCount = 0;
      const mockFetch3 = async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes("/search")) {
          return new Response(JSON.stringify(mockResponse));
        }
        if (url.includes("/comment")) {
          return new Response(JSON.stringify(mockComments));
        }
        throw new Error(`Unexpected URL: ${url}`);
      };
      mockFetch3.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch3;

      const expectedResponse = [
        {
          id: "2",
          key: "TEST-2",
          summary: "Child Issue",
          description: "Child Description",
          status: "Open",
          created: "2024-01-01T00:00:00.000Z",
          updated: "2024-01-01T00:00:00.000Z",
          comments: [
            {
              id: "1",
              body: "Test Comment mentioning TEST-5",
              author: "Test User",
              created: "2024-01-01T00:00:00.000Z",
              updated: "2024-01-01T00:00:00.000Z",
              mentions: [
                {
                  key: "TEST-5",
                  type: "mention" as const,
                  source: "comment" as const,
                  commentId: "1",
                },
                {
                  key: "TEST-6",
                  type: "mention" as const,
                  source: "comment" as const,
                  commentId: "1",
                },
              ],
            },
          ],
          relatedIssues: [
            {
              key: "TEST-5",
              type: "mention" as const,
              source: "comment" as const,
              commentId: "1",
            },
            {
              key: "TEST-6",
              type: "mention" as const,
              source: "comment" as const,
              commentId: "1",
            },
          ],
        },
      ];

      const result = await service.getEpicChildren(epicKey);
      expect(result).toEqual(expectedResponse);
    });

    test("should handle error responses", async () => {
      const mockFetch4 = async () =>
        new Response(
          JSON.stringify({ message: "You do not have permission" }),
          { status: 403 },
        );
      mockFetch4.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch4;

      await expect(service.getEpicChildren(epicKey)).rejects.toThrow(
        "JIRA API Error: You do not have permission",
      );
    });
  });

  describe("getIssueWithComments", () => {
    const issueId = "TEST-1";
    const mockIssue = {
      id: "1",
      key: "TEST-1",
      fields: {
        summary: "Test Issue",
        description: {
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Test Description with mention of TEST-7",
                },
              ],
            },
          ],
        },
        status: { name: "Open" },
        created: "2024-01-01T00:00:00.000Z",
        updated: "2024-01-01T00:00:00.000Z",
        parent: {
          id: "parent-1",
          key: "TEST-PARENT",
          fields: {
            summary: "Parent Issue",
          },
        },
        subtasks: [
          {
            id: "child-1",
            key: "TEST-CHILD",
            fields: {
              summary: "Child Issue",
            },
          },
        ],
        customfield_10014: "EPIC-1",
        issuelinks: [
          {
            type: {
              outward: "blocks",
            },
            outwardIssue: {
              key: "TEST-8",
              fields: {
                summary: "Blocked Issue",
              },
            },
          },
        ],
      },
    };

    const mockEpic = {
      fields: {
        summary: "Epic Issue",
      },
    };

    const mockComments = {
      comments: [
        {
          id: "1",
          body: {
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Test Comment mentioning TEST-9",
                  },
                ],
              },
            ],
          },
          author: { displayName: "Test User" },
          created: "2024-01-01T00:00:00.000Z",
          updated: "2024-01-01T00:00:00.000Z",
        },
      ],
    };

    test("should make parallel requests for issue, comments, and epic details", async () => {
      const mockFetch5 = async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes(`/issue/${issueId}?`)) {
          return new Response(JSON.stringify(mockIssue));
        }
        if (url.includes("/comment")) {
          return new Response(JSON.stringify(mockComments));
        }
        if (url.includes("/issue/EPIC-1")) {
          return new Response(JSON.stringify(mockEpic));
        }
        throw new Error(`Unexpected URL: ${url}`);
      };
      mockFetch5.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch5;

      const result = await service.getIssueWithComments(issueId);
      expect(result).toEqual({
        id: "1",
        key: "TEST-1",
        summary: "Test Issue",
        description: "Test Description with mention of TEST-7",
        status: "Open",
        created: "2024-01-01T00:00:00.000Z",
        updated: "2024-01-01T00:00:00.000Z",
        parent: {
          id: "parent-1",
          key: "TEST-PARENT",
          summary: "Parent Issue",
        },
        children: [
          {
            id: "child-1",
            key: "TEST-CHILD",
            summary: "Child Issue",
          },
        ],
        epicLink: {
          id: "EPIC-1",
          key: "EPIC-1",
          summary: "Epic Issue",
        },
        comments: [
          {
            id: "1",
            body: "Test Comment mentioning TEST-9",
            author: "Test User",
            created: "2024-01-01T00:00:00.000Z",
            updated: "2024-01-01T00:00:00.000Z",
            mentions: [
              {
                key: "TEST-9",
                type: "mention" as const,
                source: "comment" as const,
                commentId: "1",
              },
            ],
          },
        ],
        relatedIssues: [
          {
            key: "TEST-7",
            type: "mention" as const,
            source: "description" as const,
          },
          {
            key: "TEST-8",
            summary: "Blocked Issue",
            type: "link" as const,
            relationship: "blocks",
            source: "description" as const,
          },
          {
            key: "TEST-9",
            type: "mention" as const,
            source: "comment" as const,
            commentId: "1",
          },
        ],
      });
    });

    test("should handle epic fetch failure gracefully", async () => {
      const mockFetch6 = async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes(`/issue/${issueId}?`)) {
          return new Response(JSON.stringify(mockIssue));
        }
        if (url.includes("/comment")) {
          return new Response(JSON.stringify(mockComments));
        }
        if (url.includes("/issue/EPIC-1")) {
          return new Response("Not Found", { status: 404 });
        }
        throw new Error(`Unexpected URL: ${url}`);
      };
      mockFetch6.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch6;

      const result = await service.getIssueWithComments(issueId);
      expect(result.epicLink?.summary).toBeUndefined();
    });

    test("should handle 404 errors correctly", async () => {
      const mockFetch7 = async () => new Response("Not Found", { status: 404 });
      mockFetch7.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch7;

      await expect(service.getIssueWithComments(issueId)).rejects.toThrow(
        `Issue not found: ${issueId}`,
      );
    });

    test("should handle permission errors", async () => {
      const mockFetch8 = async () =>
        new Response(
          JSON.stringify({
            message: "You do not have permission to view this issue",
          }),
          { status: 403 },
        );
      mockFetch8.preconnect = async () => {}; // Add dummy preconnect
      global.fetch = mockFetch8;

      await expect(service.getIssueWithComments(issueId)).rejects.toThrow(
        "JIRA API Error: You do not have permission to view this issue",
      );
    });
  });

  describe("addCommentToIssue", () => {
    const issueIdOrKey = "TEST-10";
    const commentBody = "This is a new comment.";
    const expectedAdf = {
      version: 1,
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: commentBody,
            },
          ],
        },
      ],
    };
    const mockApiResponse: any = {
      // Using 'any' for brevity in mock
      id: "12345",
      self: `${baseUrl}/rest/api/3/issue/${issueIdOrKey}/comment/12345`,
      author: { displayName: "Test User" },
      body: expectedAdf, // JIRA returns ADF
      created: "2024-01-02T00:00:00.000Z",
      updated: "2024-01-02T00:00:00.000Z",
    };
    const expectedCleanResponse = {
      id: "12345",
      author: "Test User",
      created: "2024-01-02T00:00:00.000Z",
      updated: "2024-01-02T00:00:00.000Z",
      body: commentBody, // Cleaned response has plain text
    };

    test("should send POST request with correct ADF body and return cleaned response on success", async () => {
      const mockFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const url = input.toString();
        expect(url).toBe(`${baseUrl}/rest/api/3/issue/${issueIdOrKey}/comment`);
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual(service["headers"]); // Check if headers match the instance headers

        const sentBody = JSON.parse(init?.body as string);
        expect(sentBody.body).toEqual(expectedAdf); // Verify the ADF structure

        return new Response(JSON.stringify(mockApiResponse), { status: 201 });
      };
      mockFetch.preconnect = async () => {};
      global.fetch = mockFetch;

      const result = await service.addCommentToIssue(issueIdOrKey, commentBody);
      expect(result).toEqual(expectedCleanResponse);
    });

    test("should handle 404 Not Found error", async () => {
      const mockFetch = async () =>
        new Response(
          JSON.stringify({
            errorMessages: [
              "Issue does not exist or you do not have permission to see it.",
            ],
          }),
          { status: 404 },
        );
      mockFetch.preconnect = async () => {};
      global.fetch = mockFetch;

      await expect(
        service.addCommentToIssue(issueIdOrKey, commentBody),
      ).rejects.toThrow(
        "JIRA API Error: Issue does not exist or you do not have permission to see it.",
      );
    });

    test("should handle 403 Forbidden error", async () => {
      const mockFetch = async () =>
        new Response(
          JSON.stringify({
            errorMessages: [
              "User does not have permission to comment on this issue.",
            ],
          }),
          { status: 403 },
        );
      mockFetch.preconnect = async () => {};
      global.fetch = mockFetch;

      await expect(
        service.addCommentToIssue(issueIdOrKey, commentBody),
      ).rejects.toThrow(
        "JIRA API Error: User does not have permission to comment on this issue.",
      );
    });

    test("should handle 400 Bad Request error", async () => {
      const mockFetch = async () =>
        new Response(
          JSON.stringify({ errorMessages: ["Invalid request body"] }),
          { status: 400 },
        );
      mockFetch.preconnect = async () => {};
      global.fetch = mockFetch;

      await expect(
        service.addCommentToIssue(issueIdOrKey, commentBody),
      ).rejects.toThrow("JIRA API Error: Invalid request body");
    });
  });
});
