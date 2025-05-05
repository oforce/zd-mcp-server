import type * as ZendeskTypes from "node-zendesk";
import zendesk from "node-zendesk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

if (!process.env.ZENDESK_EMAIL || !process.env.ZENDESK_TOKEN || !process.env.ZENDESK_SUBDOMAIN) {
  throw new Error('Missing required environment variables: ZENDESK_EMAIL, ZENDESK_TOKEN, ZENDESK_SUBDOMAIN');
}

const client = zendesk.createClient({
  username: process.env.ZENDESK_EMAIL as string,
  token: process.env.ZENDESK_TOKEN as string,
  remoteUri: `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`,
});

export function zenDeskTools(server: McpServer) {
  server.tool(
    "zendesk_get_ticket",
    "Get a Zendesk ticket by ID",
    {
      ticket_id: z.string().describe("The ID of the ticket to retrieve"),
    },
    async ({ ticket_id }) => {
      try {
        const result = await new Promise((resolve, reject) => {
          client.tickets.show(parseInt(ticket_id, 10), (error: Error | undefined, req: any, result: any) => {
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

  server.tool(
    "zendesk_search",
    "Search for Zendesk tickets based on a query",
    {
      query: z.string().describe("Search query (e.g., 'status:open', 'priority:urgent', 'tags:need_help')"),
    },
    async ({ query }) => {
      try {
        const result = await new Promise((resolve, reject) => {
          (client as any).search.query(query, (error: Error | undefined, req: any, result: any) => {
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

  server.tool(
    "zendesk_get_ticket_details",
    "Get detailed information about a Zendesk ticket including comments",
    {
      ticket_id: z.string().describe("The ID of the ticket to retrieve details for"),
    },
    async ({ ticket_id }) => {
      try {
        // Get the ticket
        const ticketResult = await new Promise((resolve, reject) => {
          client.tickets.show(parseInt(ticket_id, 10), (error: Error | undefined, req: any, result: any) => {
            if (error) {
              console.log(error);
              reject(error);
            } else {
              resolve(result);
            }
          });
        });

        // Get the ticket comments
        const commentsResult = await new Promise((resolve, reject) => {
          client.tickets.getComments(parseInt(ticket_id, 10), (error: Error | undefined, req: any, result: any) => {
            if (error) {
              console.log(error);
              reject(error);
            } else {
              resolve(result);
            }
          });
        });

        // Combine the results
        const detailedResult = {
          ticket: ticketResult,
          comments: commentsResult
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(detailedResult, null, 2)
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

  server.tool(
    "zendesk_get_linked_incidents",
    "Fetch all incident tickets linked to a particular ticket",
    {
      ticket_id: z.string().describe("The ID of the ticket to retrieve linked incidents for"),
    },
    async ({ ticket_id }) => {
      try {
        const result = await new Promise((resolve, reject) => {
          (client as any).tickets.listIncidents(parseInt(ticket_id, 10), (error: Error | undefined, req: any, result: any) => {
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