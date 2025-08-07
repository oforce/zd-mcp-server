import type * as ZendeskTypes from "node-zendesk";
import zendesk from "node-zendesk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

// Exported read-only tool functions
export async function getTicket(client: any, ticketId: number): Promise<any> {
  return new Promise((resolve, reject) => {
    client.tickets.show(ticketId, (error: Error | undefined, req: any, result: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

export async function searchTickets(
  client: any, 
  query: string, 
  options?: {
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
    type?: 'ticket' | 'user' | 'organization' | 'group';
  }
): Promise<any> {
  return new Promise((resolve, reject) => {
    const searchParams: any = { query };
    
    if (options) {
      if (options.sort_by) searchParams.sort_by = options.sort_by;
      if (options.sort_order) searchParams.sort_order = options.sort_order;
      if (options.per_page) searchParams.per_page = Math.min(Math.max(options.per_page, 1), 100);
      if (options.page) searchParams.page = Math.max(options.page, 1);
      if (options.type) searchParams.type = options.type;
    }
    
    client.search.request('GET', ['search', searchParams], (error: Error | undefined, req: any, result: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

export async function getTicketDetails(client: any, ticketId: number): Promise<any> {
  const ticketResult = await getTicket(client, ticketId);
  
  const commentsResult = await new Promise((resolve, reject) => {
    client.tickets.getComments(ticketId, (error: Error | undefined, req: any, result: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });

  return {
    ticket: ticketResult,
    comments: commentsResult
  };
}

export async function getLinkedIncidents(client: any, ticketId: number): Promise<any> {
  return new Promise((resolve, reject) => {
    client.tickets.listIncidents(ticketId, (error: Error | undefined, req: any, result: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

// Environment-based client for backward compatibility
function createClient() {
  if (!process.env.ZENDESK_EMAIL || !process.env.ZENDESK_TOKEN || !process.env.ZENDESK_SUBDOMAIN) {
    throw new Error('Missing required environment variables: ZENDESK_EMAIL, ZENDESK_TOKEN, ZENDESK_SUBDOMAIN');
  }

  return zendesk.createClient({
    username: process.env.ZENDESK_EMAIL as string,
    token: process.env.ZENDESK_TOKEN as string,
    remoteUri: `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`,
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
  if (shouldRegisterTool("zendesk_get_ticket")) {
    server.tool(
      "zendesk_get_ticket",
    "Get a Zendesk ticket by ID",
    {
      ticket_id: z.string().describe("The ID of the ticket to retrieve"),
    },
    async ({ ticket_id }) => {
      try {
        const result = await getTicket(client, parseInt(ticket_id, 10));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message || 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
    );
  }

  if (shouldRegisterTool("zendesk_update_ticket")) {
    server.tool(
      "zendesk_update_ticket",
    "Update a Zendesk ticket's properties",
    {
      ticket_id: z.string().describe("The ID of the ticket to update"),
      subject: z.string().optional().describe("The new subject of the ticket"),
      status: z.enum(['new', 'open', 'pending', 'hold', 'solved', 'closed']).optional().describe("The new status of the ticket"),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe("The new priority of the ticket"),
      type: z.enum(['problem', 'incident', 'question', 'task']).optional().describe("The new type of the ticket"),
      assignee_id: z.string().optional().describe("The ID of the agent to assign the ticket to"),
      tags: z.array(z.string()).optional().describe("Tags to set on the ticket (replaces existing tags)")
    },
    async ({ ticket_id, subject, status, priority, type, assignee_id, tags }) => {
      try {
        const ticketData: any = {
          ticket: {}
        };

        // Only add properties that are provided
        if (subject) ticketData.ticket.subject = subject;
        if (status) ticketData.ticket.status = status;
        if (priority) ticketData.ticket.priority = priority;
        if (type) ticketData.ticket.type = type;
        if (assignee_id) ticketData.ticket.assignee_id = parseInt(assignee_id, 10);
        if (tags) ticketData.ticket.tags = tags;

        const result = await new Promise((resolve, reject) => {
          (client as any).tickets.update(parseInt(ticket_id, 10), ticketData, (error: Error | undefined, req: any, result: any) => {
            if (error) {
              console.log(error);
              reject(error);
            } else {
              resolve(result);
            }
          });
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message || 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
    );
  }

  if (shouldRegisterTool("zendesk_create_ticket")) {
    server.tool(
      "zendesk_create_ticket",
    "Create a new Zendesk ticket",
    {
      subject: z.string().describe("The subject of the ticket"),
      description: z.string().describe("The initial description or comment for the ticket"),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe("The priority of the ticket"),
      status: z.enum(['new', 'open', 'pending', 'hold', 'solved', 'closed']).optional().describe("The status of the ticket"),
      type: z.enum(['problem', 'incident', 'question', 'task']).optional().describe("The type of the ticket"),
      tags: z.array(z.string()).optional().describe("Tags to add to the ticket")
    },
    async ({ subject, description, priority, status, type, tags }) => {
      try {
        const ticketData: any = {
          ticket: {
            subject,
            comment: { body: description },
          }
        };

        if (priority) ticketData.ticket.priority = priority;
        if (status) ticketData.ticket.status = status;
        if (type) ticketData.ticket.type = type;
        if (tags) ticketData.ticket.tags = tags;

        const result = await new Promise((resolve, reject) => {
          (client as any).tickets.create(ticketData, (error: Error | undefined, req: any, result: any) => {
            if (error) {
              console.log(error);
              reject(error);
            } else {
              resolve(result);
            }
          });
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message || 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
    );
  }

  if (shouldRegisterTool("zendesk_add_private_note")) {
    server.tool(
      "zendesk_add_private_note",
    "Add a private internal note to a Zendesk ticket",
    {
      ticket_id: z.string().describe("The ID of the ticket to add a note to"),
      note: z.string().describe("The content of the private note")
    },
    async ({ ticket_id, note }) => {
      try {
        const result = await new Promise((resolve, reject) => {
          (client as any).tickets.update(parseInt(ticket_id, 10), {
            ticket: {
              comment: {
                body: note,
                public: false
              }
            }
          }, (error: Error | undefined, req: any, result: any) => {
            if (error) {
              console.log(error);
              reject(error);
            } else {
              resolve(result);
            }
          });
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message || 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
    );
  }

  if (shouldRegisterTool("zendesk_add_public_note")) {
    server.tool(
      "zendesk_add_public_note",
    "Add a public comment to a Zendesk ticket",
    {
      ticket_id: z.string().describe("The ID of the ticket to add a comment to"),
      comment: z.string().describe("The content of the public comment")
    },
    async ({ ticket_id, comment }) => {
      try {
        const result = await new Promise((resolve, reject) => {
          (client as any).tickets.update(parseInt(ticket_id, 10), {
            ticket: {
              comment: {
                body: comment,
                public: true
              }
            }
          }, (error: Error | undefined, req: any, result: any) => {
            if (error) {
              console.log(error);
              reject(error);
            } else {
              resolve(result);
            }
          });
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message || 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
    );
  }

  if (shouldRegisterTool("zendesk_search")) {
    server.tool(
      "zendesk_search",
    "Search for Zendesk tickets and other resources with advanced filtering and pagination",
    {
      query: z.string().describe("Search query supporting Zendesk syntax: Field searches (status:open, priority:urgent, type:ticket, tags:billing, assignee_id:123, requester:email@domain.com), comparison operators (created>2024-01-01, updated<2024-12-31), text searches with quotes for exact phrases (\"login issue\"), wildcards (login*), negation (-status:solved), and combinations (status:open priority:high created>2024-01-01). Examples: 'status:open', 'priority:urgent tags:billing', 'type:ticket \"password reset\"', '-status:solved created>2024-01-01'"),
      sort_by: z.string().optional().describe("Field to sort by (e.g., 'created_at', 'updated_at', 'priority', 'status', 'ticket_type')"),
      sort_order: z.enum(['asc', 'desc']).optional().describe("Sort order: 'asc' for ascending, 'desc' for descending"),
      per_page: z.number().min(1).max(100).optional().describe("Number of results per page (1-100, default: 100)"),
      page: z.number().min(1).optional().describe("Page number for pagination (starts from 1)"),
      type: z.enum(['ticket', 'user', 'organization', 'group']).optional().describe("Resource type to search (defaults to all types if not specified)")
    },
    async ({ query, sort_by, sort_order, per_page, page, type }) => {
      try {
        const options = {
          sort_by,
          sort_order,
          per_page,
          page,
          type
        };

        const result = await searchTickets(client, query, options);

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message || 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
    );
  }

  if (shouldRegisterTool("zendesk_get_ticket_details")) {
    server.tool(
      "zendesk_get_ticket_details",
    "Get detailed information about a Zendesk ticket including comments",
    {
      ticket_id: z.string().describe("The ID of the ticket to retrieve details for"),
    },
    async ({ ticket_id }) => {
      try {
        const result = await getTicketDetails(client, parseInt(ticket_id, 10));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message || 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
    );
  }

  if (shouldRegisterTool("zendesk_get_linked_incidents")) {
    server.tool(
      "zendesk_get_linked_incidents",
    "Fetch all incident tickets linked to a particular ticket",
    {
      ticket_id: z.string().describe("The ID of the ticket to retrieve linked incidents for"),
    },
    async ({ ticket_id }) => {
      try {
        const result = await getLinkedIncidents(client, parseInt(ticket_id, 10));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message || 'Unknown error occurred'}`
          }],
          isError: true
        };
      }
    }
    );
  }
}