import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

export function registerGetTicketTools(server: McpServer, client: any, shouldRegisterTool: (name: string) => boolean) {
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