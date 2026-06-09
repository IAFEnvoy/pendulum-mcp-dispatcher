#!/usr/bin/env node

/**
 * Pendulum MCP Dispatcher
 * 
 * A transparent forwarding layer between AI clients and the Pendulum MCP TCP server.
 * 
 * Key features:
 * - Exposes an MCP stdio server to AI clients (VS Code Copilot, Claude Desktop, etc.)
 * - Forwards all requests to the Pendulum MCP TCP server (localhost:25566 by default)
 * - Health-checks the backend; returns meaningful errors when Minecraft is not running
 * - Provides static tool definitions so AI clients always see the full tool list
 * - Does NOT auto-start Minecraft — the user must start the game + MCP server manually
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import net from "net";
import { TOOL_DEFINITIONS } from "./tools.js";

// ═══════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════

const BACKEND_HOST = process.env.PENDULUM_HOST || "127.0.0.1";
const BACKEND_PORT = parseInt(process.env.PENDULUM_PORT || "25566", 10);
const HEALTH_TIMEOUT_MS = 3000;   // How long to wait for backend health check
const REQUEST_TIMEOUT_MS = 130000; // 120s eval timeout + 10s buffer

// ═══════════════════════════════════════════════
// Backend health check
// ═══════════════════════════════════════════════

/**
 * Test if the Pendulum MCP TCP server is reachable.
 * We send a minimal JSON-RPC request (tools/list) to verify full connectivity.
 */
function checkBackendHealth() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let buffer = "";
    let resolved = false;

    const finish = (ok, reason) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ ok, reason });
    };

    socket.setTimeout(HEALTH_TIMEOUT_MS);
    socket.connect(BACKEND_PORT, BACKEND_HOST, () => {
      // Send a minimal tools/list request to verify the full JSON-RPC pipeline
      const req = JSON.stringify({
        jsonrpc: "2.0",
        id: "health",
        method: "tools/list",
        params: {},
      });
      socket.write(req + "\n");
    });

    socket.on("data", (data) => {
      buffer += data.toString("utf-8");
      try {
        JSON.parse(buffer.trim());
        finish(true, null);
      } catch (_) {
        // Partial response, wait for more data
      }
    });

    socket.on("timeout", () => finish(false, "Connection timed out — Minecraft may not be running"));
    socket.on("error", (err) => finish(false, err.message));
    socket.on("close", () => finish(false, "Connection closed by backend"));
  });
}

/**
 * Execute a raw JSON-RPC call against the Pendulum MCP TCP server.
 * Opens a fresh connection for each request (simple, thread-safe).
 */
function callBackend(method, params) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = "";
    let resolved = false;

    const id = "disp-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
    const request = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: params || {},
    });

    socket.setTimeout(REQUEST_TIMEOUT_MS);

    socket.connect(BACKEND_PORT, BACKEND_HOST, () => {
      socket.write(request + "\n");
    });

    socket.on("data", (data) => {
      buffer += data.toString("utf-8");
      try {
        // Pendulum MCP TCP sends one JSON object per line
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.id === id || msg.method === "notifications/message") {
            if (msg.result !== undefined) {
              resolved = true;
              socket.destroy();
              resolve(msg.result);
              return;
            }
            if (msg.error) {
              resolved = true;
              socket.destroy();
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
              return;
            }
          }
        }
      } catch (_) {
        // Partial JSON, keep buffering
      }
    });

    socket.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      reject(err);
    });

    socket.on("timeout", () => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      reject(new Error("Request timed out (120s+) — the script may be too long. Use script/evalAsync for long scripts."));
    });

    socket.on("close", () => {
      if (resolved) return;
      resolved = true;
      reject(new Error("Backend closed the connection unexpectedly — may have crashed"));
    });
  });
}

// ═══════════════════════════════════════════════
// MCP Server (stdio transport → AI client)
// ═══════════════════════════════════════════════

async function main() {
  const server = new Server(
    {
      name: "pendulum-dispatcher",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ── tools/list: always return static definitions ──
  // This ensures the AI client always sees the full tool list even when
  // Minecraft is not running, preventing context errors.
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    let health = "unknown";
    try {
      const result = await checkBackendHealth();
      health = result.ok ? "connected" : result.reason;
    } catch (_) {
      health = "check failed";
    }

    // Append health status to the first tool's description as a hint
    const tools = TOOL_DEFINITIONS.map((t, i) => {
      if (i === 0 && health !== "connected") {
        return {
          ...t,
          description: `[Backend: ${health}] ${t.description}`,
        };
      }
      return t;
    });

    return { tools };
  });

  // ── tools/call: forward to backend ──
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};

    // 1) Health check
    const health = await checkBackendHealth();
    if (!health.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Pendulum MCP server is not reachable (${BACKEND_HOST}:${BACKEND_PORT}).\n\n` +
              `Reason: ${health.reason}\n\n` +
              `Please ensure:\n` +
              `1. Minecraft is running\n` +
              `2. The Pendulum mod is installed\n` +
              `3. MCP server is started: /pendulum mcp start\n\n` +
              `Then retry your request.`,
          },
        ],
        isError: true,
      };
    }

    // 2) Forward the request to the real Pendulum MCP server
    try {
      const result = await callBackend("tools/call", {
        name: toolName,
        arguments: args,
      });

      // Unwrap the result — Pendulum returns { content: [...] }
      if (result && result.content) {
        return { content: result.content };
      }

      // Some responses may be a plain string
      if (typeof result === "string") {
        return {
          content: [{ type: "text", text: result }],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Pendulum MCP error: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // ── Start the server ──
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[pendulum-dispatcher] Listening on stdio");
  console.error(`[pendulum-dispatcher] Backend: ${BACKEND_HOST}:${BACKEND_PORT}`);

  // Initial health check
  const health = await checkBackendHealth();
  if (health.ok) {
    console.error("[pendulum-dispatcher] ✓ Backend is reachable");
  } else {
    console.error(`[pendulum-dispatcher] ⚠ Backend not reachable: ${health.reason}`);
    console.error("[pendulum-dispatcher]   Start Minecraft + /pendulum mcp start, then retry");
  }
}

main().catch((err) => {
  console.error("[pendulum-dispatcher] Fatal error:", err.message);
  process.exit(1);
});
