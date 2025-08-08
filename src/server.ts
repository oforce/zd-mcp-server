import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { zenDeskTools } from "./tools/index.js";
import { ZendeskAuth } from "./auth/ZendeskAuth.js";
import { getAuthManager, setAuthManager } from "./tools/oauth.js";

interface ServerOptions {
  http?: boolean | string;
  enabledTools?: string;
  version: string;
}

// Store registered clients in memory (in production, use a database)
interface RegisteredClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope?: string;
  token_endpoint_auth_method: string;
  created_at: number;
}

const registeredClients = new Map<string, RegisteredClient>();

// Simple Zendesk OAuth provider for streamable HTTP
class ZendeskOAuthProvider {
  async getAuthorizationUrl(params: any): Promise<string> {
    const subdomain = process.env.ZENDESK_SUBDOMAIN;
    if (!subdomain) {
      throw new Error('ZENDESK_SUBDOMAIN not configured');
    }

    const authUrl = new URL(`https://${subdomain}.zendesk.com/oauth/authorizations/new`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', process.env.ZENDESK_CLIENT_ID || '');
    authUrl.searchParams.set('redirect_uri', params.redirect_uri);
    authUrl.searchParams.set('scope', params.scope || 'read write');
    authUrl.searchParams.set('state', params.state || '');

    return authUrl.toString();
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
    const subdomain = process.env.ZENDESK_SUBDOMAIN;
    const clientId = process.env.ZENDESK_CLIENT_ID;
    const clientSecret = process.env.ZENDESK_CLIENT_SECRET;

    if (!subdomain || !clientId || !clientSecret) {
      throw new Error('OAuth not properly configured');
    }

    const response = await fetch(`https://${subdomain}.zendesk.com/oauth/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return await response.json();
  }
}

export class ZendeskMcpServer {
  private options: ServerOptions;
  private server: McpServer | null = null;
  private oauthProvider: ZendeskOAuthProvider;

  constructor(options: ServerOptions) {
    this.options = options;
    this.oauthProvider = new ZendeskOAuthProvider();
  }

  async initialize(): Promise<void> {
    this.server = new McpServer({
      name: "zendesk-mcp",
      version: this.options.version,
    }, {
      capabilities: {
        logging: {},
      },
    });

    // Parse enabled tools regex if provided
    let enabledToolsRegex: RegExp | undefined;
    if (this.options.enabledTools) {
      try {
        enabledToolsRegex = new RegExp(this.options.enabledTools, 'i');
        console.error(`Tool filtering enabled with pattern: ${this.options.enabledTools}`);
      } catch (error) {
        console.error(`Invalid tool filter regex pattern: ${this.options.enabledTools}. Ignoring filter.`);
      }
    }

    zenDeskTools(this.server, enabledToolsRegex);
  }

  async start(): Promise<void> {
    if (!this.server) {
      throw new Error('Server not initialized');
    }

    if (this.options.http) {
      await this.startHttpServer();
    } else {
      await this.startStdioServer();
    }
  }

  private async startHttpServer(): Promise<void> {
    const port = typeof this.options.http === 'string' ? parseInt(this.options.http) : 3000;
    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Add CORS headers for all routes
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, mcp-protocol-version'
      );

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    });

    // OAuth Authorization Server Discovery
    app.get('/.well-known/oauth-authorization-server', async (req, res) => {
      const url = new URL(`${req.protocol}://${req.get('host')}`);
      res.json({
        issuer: url.origin,
        authorization_endpoint: `${url.origin}/authorize`,
        token_endpoint: `${url.origin}/token`,
        registration_endpoint: `${url.origin}/register`,
        response_types_supported: ['code'],
        response_modes_supported: ['query'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: ['read', 'write'],
      });
    });

    // OAuth Protected Resource Discovery
    app.get('/.well-known/oauth-protected-resource', async (req, res) => {
      const url = new URL(`${req.protocol}://${req.get('host')}`);
      res.json({
        resource: `${url.origin}/mcp`,
        authorization_servers: [url.origin],
        scopes_supported: ['read', 'write'],
        bearer_methods_supported: ['header'],
        resource_documentation: `${url.origin}`,
      });
    });

    // Dynamic Client Registration endpoint
    app.post('/register', async (req, res) => {
      const body = req.body;

      // Generate a client ID
      const clientId = crypto.randomUUID();

      // Store the client registration
      registeredClients.set(clientId, {
        client_id: clientId,
        client_name: body.client_name || 'Zendesk MCP Client',
        redirect_uris: body.redirect_uris || [],
        grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
        response_types: body.response_types || ['code'],
        scope: body.scope,
        token_endpoint_auth_method: 'none',
        created_at: Date.now(),
      });

      // Return the client registration response
      res.status(201).json({
        client_id: clientId,
        client_name: body.client_name || 'Zendesk MCP Client',
        redirect_uris: body.redirect_uris || [],
        grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
        response_types: body.response_types || ['code'],
        scope: body.scope,
        token_endpoint_auth_method: 'none',
      });
    });

    // Authorization endpoint - redirects to Zendesk
    app.get('/authorize', async (req, res) => {
      try {
        const authUrl = await this.oauthProvider.getAuthorizationUrl(req.query);
        res.redirect(authUrl);
      } catch (error) {
        console.error('Authorization error:', error);
        res.status(500).json({
          error: 'server_error',
          error_description: 'Authorization failed',
        });
      }
    });

    // Token exchange endpoint
    app.post('/token', async (req, res) => {
      try {
        const body = req.body;

        if (!body.grant_type) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'grant_type parameter is required',
          });
          return;
        }

        if (body.grant_type === 'authorization_code') {
          const result = await this.oauthProvider.exchangeCodeForToken(
            body.code as string,
            body.redirect_uri as string
          );
          res.json(result);
        } else {
          res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: `Grant type '${body.grant_type}' is not supported`,
          });
        }
      } catch (error) {
        console.error('Token endpoint error:', error);
        res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error during token exchange',
        });
      }
    });

    // Bearer token middleware for Zendesk API
    const zendeskBearerTokenMiddleware = async (req: Request & { zendeskAuth?: { accessToken: string } }, res: Response, next: any) => {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        req.zendeskAuth = { accessToken: token };
        
        // Set the token in our auth manager if we have one
        const authManager = getAuthManager();
        if (authManager) {
          // This is a bit of a hack - we'd need to modify ZendeskAuth to support external token setting
          // For now, we'll create a new auth manager with the token
          const subdomain = process.env.ZENDESK_SUBDOMAIN;
          const clientId = process.env.ZENDESK_CLIENT_ID;
          const clientSecret = process.env.ZENDESK_CLIENT_SECRET;
          
          if (subdomain && clientId && clientSecret) {
            const newAuthManager = new ZendeskAuth(subdomain, clientId, clientSecret);
            // We'd need to add a method to set the token directly
            setAuthManager(newAuthManager);
          }
        }
      }
      
      next();
    };

    // MCP endpoints with bearer token auth
    app.get('/mcp', zendeskBearerTokenMiddleware, async (req: Request & { zendeskAuth?: { accessToken: string } }, res: Response) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
        });

        res.on('close', () => {
          transport.close();
        });

        await this.server!.connect(transport);
        await transport.handleRequest(req as any, res as any, undefined);
      } catch (error) {
        console.error('Error handling MCP GET request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    app.post('/mcp', zendeskBearerTokenMiddleware, async (req: Request & { zendeskAuth?: { accessToken: string } }, res: Response) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
        });

        res.on('close', () => {
          transport.close();
        });

        await this.server!.connect(transport);
        await transport.handleRequest(req as any, res as any, req.body);
      } catch (error) {
        console.error('Error handling MCP POST request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // Health check endpoint
    app.get('/', (req, res) => {
      res.send('Zendesk MCP Server is running');
    });

    app.listen(port, () => {
      console.error(`Zendesk MCP Server listening on HTTP port ${port}`);
      console.error(`  - MCP endpoint: http://localhost:${port}/mcp`);
      console.error(`  - OAuth endpoints: http://localhost:${port}/auth/*`);
      console.error(`  - OAuth discovery: http://localhost:${port}/.well-known/oauth-authorization-server`);
    });
  }

  private async startStdioServer(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server!.connect(transport);
    console.error(`Zendesk MCP Server v${this.options.version} running on stdio`);
  }
}