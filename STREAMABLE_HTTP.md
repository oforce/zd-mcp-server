# Streamable HTTP Transport Usage

The Zendesk MCP Server now supports the [MCP Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) protocol.

## Quick Start

### 1. Start the HTTP Server

```bash
# Start on default port 3000
zd-mcp-server --http

# Start on custom port
zd-mcp-server --http 8080

# With OAuth configuration
ZENDESK_SUBDOMAIN=mycompany \
ZENDESK_CLIENT_ID=your-oauth-client-id \
ZENDESK_CLIENT_SECRET=your-oauth-secret \
zd-mcp-server --http 3000
```

### 2. Available Endpoints

- **MCP Protocol**: `http://localhost:3000/mcp`
- **Health Check**: `http://localhost:3000/`
- **OAuth Discovery**: `http://localhost:3000/.well-known/oauth-authorization-server`
- **Resource Discovery**: `http://localhost:3000/.well-known/oauth-protected-resource`

### 3. OAuth Flow Endpoints

- **Client Registration**: `POST http://localhost:3000/register`
- **Authorization**: `GET http://localhost:3000/authorize`
- **Token Exchange**: `POST http://localhost:3000/token`

## MCP Client Integration

### Discovery

```bash
curl http://localhost:3000/.well-known/oauth-authorization-server
```

Response:
```json
{
  "issuer": "http://localhost:3000",
  "authorization_endpoint": "http://localhost:3000/authorize",
  "token_endpoint": "http://localhost:3000/token",
  "registration_endpoint": "http://localhost:3000/register",
  "response_types_supported": ["code"],
  "response_modes_supported": ["query"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["none"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["read", "write"]
}
```

### Client Registration

```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My MCP Client",
    "redirect_uris": ["http://localhost:8080/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"]
  }'
```

### MCP Protocol Usage

Once authenticated with a bearer token:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-oauth-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### Using Tools via HTTP

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-oauth-token" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "zendesk_search",
      "arguments": {
        "query": "status:open"
      }
    }
  }'
```

## Benefits of HTTP Transport

1. **Web Integration**: Easy to integrate with web applications
2. **OAuth Security**: Built-in OAuth 2.0 flow for secure authentication
3. **Stateless**: No persistent connections required
4. **Standard HTTP**: Works with any HTTP client or proxy
5. **CORS Support**: Ready for browser-based clients

## Environment Variables

For HTTP mode, you can use either:

**OAuth (Recommended):**
```bash
ZENDESK_SUBDOMAIN=mycompany
ZENDESK_CLIENT_ID=your-oauth-client-id
ZENDESK_CLIENT_SECRET=your-oauth-secret
```

**API Token (Legacy):**
```bash
ZENDESK_SUBDOMAIN=mycompany
ZENDESK_EMAIL=agent@company.com
ZENDESK_TOKEN=your-api-token
```

The server will automatically detect which authentication method to use based on the available environment variables.