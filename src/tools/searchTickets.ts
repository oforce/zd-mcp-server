import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

export function registerSearchTool(server: McpServer, client: any, shouldRegisterTool: (name: string) => boolean) {
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
}