// JiraServerApiService: Jira Server (Data Center) implementation
// This class should override methods as needed for Jira Server differences
import { JiraApiService } from "./jira-api.js";

export class JiraServerApiService extends JiraApiService {
  constructor(baseUrl: string, email: string, apiToken: string, authType: 'basic' | 'bearer' = 'basic') {
    // For Jira Server/Data Center:
    // - Basic Auth: username/password or API token (traditional method)
    // - Bearer Auth: Personal Access Tokens (PATs) available in Data Center 8.14.0+
    super(baseUrl, email, apiToken, authType);
  }

  // Example: Override fetchJson to use /rest/api/2/ instead of /rest/api/3/
  protected overrideApiPath(path: string): string {
    // Replace /rest/api/3/ with /rest/api/2/ for Jira Server
    return path.replace("/rest/api/3/", "/rest/api/2/");
  }

  // Override fetchJson to use the correct API path
  protected async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const serverUrl = this.overrideApiPath(url);
    return super.fetchJson<T>(serverUrl, init);
  }

  // You may need to override other methods for Jira Server quirks (e.g., ADF support, field names)
  // Add overrides here as needed
}
