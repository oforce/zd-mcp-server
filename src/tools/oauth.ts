import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZendeskAuth } from "../auth/ZendeskAuth.js";

// Global auth instance
let authManager: ZendeskAuth | null = null;

export function getAuthManager(): ZendeskAuth | null {
  return authManager;
}

export function setAuthManager(manager: ZendeskAuth): void {
  authManager = manager;
}

export function registerOAuthTools(server: McpServer, shouldRegisterTool: (name: string) => boolean) {
  if (shouldRegisterTool("zendesk_oauth_login")) {
    server.tool(
      "zendesk_oauth_login",
      "Login to Zendesk using OAuth device flow",
      {},
      async () => {
        try {
          if (!process.env.ZENDESK_CLIENT_ID || !process.env.ZENDESK_CLIENT_SECRET || !process.env.ZENDESK_SUBDOMAIN) {
            return {
              content: [{
                type: "text",
                text: "OAuth not configured. Please set ZENDESK_CLIENT_ID, ZENDESK_CLIENT_SECRET, and ZENDESK_SUBDOMAIN environment variables."
              }],
              isError: true
            };
          }

          if (!authManager) {
            authManager = new ZendeskAuth(
              process.env.ZENDESK_SUBDOMAIN,
              process.env.ZENDESK_CLIENT_ID,
              process.env.ZENDESK_CLIENT_SECRET
            );
          }

          if (authManager.isAuthenticated()) {
            return {
              content: [{
                type: "text",
                text: "Already logged in to Zendesk."
              }]
            };
          }

          await authManager.login();

          return {
            content: [{
              type: "text",
              text: "Successfully logged in to Zendesk using OAuth!"
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `OAuth login failed: ${error.message || 'Unknown error occurred'}`
            }],
            isError: true
          };
        }
      }
    );
  }

  if (shouldRegisterTool("zendesk_oauth_logout")) {
    server.tool(
      "zendesk_oauth_logout",
      "Logout from Zendesk OAuth session",
      {},
      async () => {
        try {
          if (authManager) {
            authManager.logout();
          }

          return {
            content: [{
              type: "text",
              text: "Successfully logged out from Zendesk."
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `Logout failed: ${error.message || 'Unknown error occurred'}`
            }],
            isError: true
          };
        }
      }
    );
  }
}