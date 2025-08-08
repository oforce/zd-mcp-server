import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerManageTicketTools(server: McpServer, client: any, shouldRegisterTool: (name: string) => boolean) {
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
}