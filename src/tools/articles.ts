import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export async function searchArticles(
  client: any, 
  query: string, 
  options?: {
    locale?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
    category?: string;
    section?: string;
    brand?: string;
    label_names?: string[];
    created_before?: string;
    created_after?: string;
  }
): Promise<any> {
  return new Promise((resolve, reject) => {
    const searchParams: any = { query };
    
    if (options) {
      if (options.locale) searchParams.locale = options.locale;
      if (options.sort_by) searchParams.sort_by = options.sort_by;
      if (options.sort_order) searchParams.sort_order = options.sort_order;
      if (options.per_page) searchParams.per_page = Math.min(Math.max(options.per_page, 1), 100);
      if (options.page) searchParams.page = Math.max(options.page, 1);
      if (options.category) searchParams.category = options.category;
      if (options.section) searchParams.section = options.section;
      if (options.label_names && options.label_names.length > 0) {
        searchParams.label_names = options.label_names.join(',');
      }
      if (options.created_before) searchParams.created_before = options.created_before;
      if (options.created_after) searchParams.created_after = options.created_after;
    }
    
    client.search.request('GET', ['help_center', 'articles', 'search', searchParams], (error: Error | undefined, req: any, result: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

export async function listArticles(client: any, options?: { per_page?: number; page?: number; locale?: string; }): Promise<any> {
  return new Promise((resolve, reject) => {
    const params = {};
    if (options?.per_page) (params as any).per_page = Math.min(Math.max(options.per_page, 1), 100);
    if (options?.page) (params as any).page = Math.max(options.page, 1);
    
    const locale = options?.locale || 'en-us';
    
    client.search.request('GET', ['help_center', locale, 'articles', params], (error: Error | undefined, req: any, result: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

export async function getArticle(client: any, articleId: number, locale?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const localeParam = locale || 'en-us';
    
    client.search.request('GET', ['help_center', localeParam, 'articles', articleId], (error: Error | undefined, req: any, result: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

export function registerArticleTools(server: McpServer, client: any, shouldRegisterTool: (name: string) => boolean) {
  if (shouldRegisterTool("zendesk_search_articles")) {
    server.tool(
      "zendesk_search_articles",
      "Search for Zendesk Help Center articles with advanced filtering and pagination",
      {
        query: z.string().describe("Search query for Help Center articles. Supports text search for matching article content, titles, and keywords"),
        locale: z.string().optional().describe("Language locale (e.g., 'en-us', 'fr', 'de'). Filters articles by language"),
        sort_by: z.string().optional().describe("Field to sort by (e.g., 'created_at', 'updated_at', 'position', 'title')"),
        sort_order: z.enum(['asc', 'desc']).optional().describe("Sort order: 'asc' for ascending, 'desc' for descending"),
        per_page: z.number().min(1).max(100).optional().describe("Number of results per page (1-100, default: 30)"),
        page: z.number().min(1).optional().describe("Page number for pagination (starts from 1)"),
        category: z.string().optional().describe("Category ID to filter articles by specific category"),
        section: z.string().optional().describe("Section ID to filter articles by specific section"),
        brand: z.string().optional().describe("Brand ID to filter articles by brand"),
        label_names: z.array(z.string()).optional().describe("Array of label names to filter articles by specific labels"),
        created_before: z.string().optional().describe("ISO 8601 date string to find articles created before this date"),
        created_after: z.string().optional().describe("ISO 8601 date string to find articles created after this date")
      },
      async ({ query, locale, sort_by, sort_order, per_page, page, category, section, brand, label_names, created_before, created_after }) => {
        try {
          const options = {
            locale,
            sort_by,
            sort_order,
            per_page,
            page,
            category,
            section,
            brand,
            label_names,
            created_before,
            created_after
          };

          const result = await searchArticles(client, query, options);

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

  if (shouldRegisterTool("zendesk_list_articles")) {
    server.tool(
      "zendesk_list_articles",
      "List all Zendesk Help Center articles with pagination",
      {
        per_page: z.number().min(1).max(100).optional().describe("Number of results per page (1-100, default: 30)"),
        page: z.number().min(1).optional().describe("Page number for pagination (starts from 1)"),
        locale: z.string().optional().describe("Language locale (e.g., 'en-us', 'fr', 'de'). Defaults to 'en-us'")
      },
      async ({ per_page, page, locale }) => {
        try {
          const options = {
            per_page,
            page,
            locale
          };

          const result = await listArticles(client, options);

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

  if (shouldRegisterTool("zendesk_get_article")) {
    server.tool(
      "zendesk_get_article",
      "Get a specific Zendesk Help Center article by ID",
      {
        article_id: z.string().describe("The ID of the Help Center article to retrieve"),
        locale: z.string().optional().describe("Language locale (e.g., 'en-us', 'fr', 'de'). Defaults to 'en-us'")
      },
      async ({ article_id, locale }) => {
        try {
          const result = await getArticle(client, parseInt(article_id, 10), locale);

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