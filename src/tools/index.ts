import type * as ZendeskTypes from "node-zendesk";
import zendesk from "node-zendesk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZendeskAuth } from "../auth/ZendeskAuth.js";

// Import tool registrations
import { registerSearchTool } from "./searchTickets.js";
import { registerGetTicketTools } from "./getTicket.js";
import { registerManageTicketTools } from "./manageTickets.js";
import { registerArticleTools } from "./articles.js";
import { registerOAuthTools, getAuthManager, setAuthManager } from "./oauth.js";

// Re-export functions for library usage
export { searchTickets } from "./searchTickets.js";
export { getTicket, getTicketDetails, getLinkedIncidents } from "./getTicket.js";
export { searchArticles, listArticles, getArticle } from "./articles.js";

// Types for exported functions
export interface ZendeskConfig {
  email: string;
  token: string;
  subdomain: string;
}

// Create Zendesk client
export function createZendeskClient(config: ZendeskConfig) {
  return zendesk.createClient({
    username: config.email,
    token: config.token,
    remoteUri: `https://${config.subdomain}.zendesk.com/api/v2`,
  });
}

// Environment-based client for backward compatibility
function createClient() {
  // Check for OAuth configuration first
  if (process.env.ZENDESK_CLIENT_ID && process.env.ZENDESK_CLIENT_SECRET && process.env.ZENDESK_SUBDOMAIN) {
    let authManager = getAuthManager();
    
    if (!authManager) {
      authManager = new ZendeskAuth(
        process.env.ZENDESK_SUBDOMAIN,
        process.env.ZENDESK_CLIENT_ID,
        process.env.ZENDESK_CLIENT_SECRET
      );
      setAuthManager(authManager);
    }
    
    if (authManager.isAuthenticated()) {
      return zendesk.createClient({
        username: 'oauth', // Required but unused in OAuth mode
        token: authManager.getToken() as string,
        remoteUri: `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`,
        oauth: true,
      });
    } else {
      // Return a dummy client for HTTP mode - tools will handle auth via bearer tokens
      return zendesk.createClient({
        username: 'oauth',
        token: 'placeholder',
        remoteUri: `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`,
        oauth: true,
      });
    }
  }

  // Fall back to API token authentication
  if (process.env.ZENDESK_EMAIL && process.env.ZENDESK_TOKEN && process.env.ZENDESK_SUBDOMAIN) {
    return zendesk.createClient({
      username: process.env.ZENDESK_EMAIL as string,
      token: process.env.ZENDESK_TOKEN as string,
      remoteUri: `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`,
    });
  }

  // If no credentials are available, return a dummy client
  // In HTTP mode, the actual authentication will be handled via bearer tokens
  return zendesk.createClient({
    username: 'placeholder',
    token: 'placeholder',
    remoteUri: 'https://placeholder.zendesk.com/api/v2',
  });
}

export function zenDeskTools(server: McpServer, enabledToolsRegex?: RegExp) {
  const client = createClient();
  
  const shouldRegisterTool = (toolName: string): boolean => {
    if (!enabledToolsRegex) return true;
    const shouldRegister = enabledToolsRegex.test(toolName);
    if (!shouldRegister) {
      console.error(`Skipping tool ${toolName} - doesn't match filter pattern`);
    }
    return shouldRegister;
  };

  // Register all tool modules
  registerSearchTool(server, client, shouldRegisterTool);
  registerGetTicketTools(server, client, shouldRegisterTool);
  registerManageTicketTools(server, client, shouldRegisterTool);
  registerArticleTools(server, client, shouldRegisterTool);
  registerOAuthTools(server, shouldRegisterTool);
}