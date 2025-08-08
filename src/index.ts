#!/usr/bin/env node

import { ZendeskMcpServer } from "./server.js";
import { createZendeskClient, searchTickets, getTicket, getTicketDetails, getLinkedIncidents, searchArticles, getArticle, listArticles } from "./tools/index.js";
import { Command } from "commander";

// Re-export the functions for library usage
export { createZendeskClient, searchTickets, getTicket, getTicketDetails, getLinkedIncidents, searchArticles, getArticle, listArticles } from "./tools/index.js";
export type { ZendeskConfig } from "./tools/index.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8")
);
const VERSION = packageJson.version;

async function main() {
  const program = new Command();
  
  program
    .name('zd-mcp-server')
    .description('Zendesk MCP Server - Model Context Protocol server for Zendesk Support and Help Center integration')
    .version(VERSION)
    .option(
      '--enabled-tools <pattern>',
      'Filter tools using regex pattern (e.g., "search|ticket" to enable search and ticket tools)'
    )
    .option(
      '--http [port]',
      'Run server over HTTP instead of stdio (default port: 3000)'
    )
    .parse();

  const options = program.opts();
  
  const serverOptions = {
    http: options.http,
    enabledTools: options.enabledTools,
    version: VERSION,
  };

  const server = new ZendeskMcpServer(serverOptions);
  await server.initialize();
  await server.start();
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});