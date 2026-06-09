# Pendulum Dispatcher

Pendulum MCP dispatcher layer — a transparent proxy between AI clients and the Minecraft MCP server.

## Why a Dispatcher Layer

Pendulum's MCP server runs inside the Minecraft game (TCP port 25566). When the game is not running, AI clients (such as VS Code Copilot, Claude Desktop) cannot discover the tool list, causing **context errors**.

This dispatcher layer solves the problem:

- **Static tool descriptions**: Built-in complete definitions for 22 tools, so AI clients can see all tools even when the game is not running
- **Health check**: Verifies backend connectivity before every call; returns a clear error message when unreachable
- **Transparent forwarding**: Once the backend is ready, all requests are forwarded as-is with zero performance loss

## Installation

```bash
cd dispatcher
npm install
```

## Usage

```bash
# Default connection to localhost:25566
node index.js

# Custom backend address
PENDULUM_HOST=192.168.1.100 PENDULUM_PORT=25566 node index.js
```

## Configuring AI Clients

### VS Code Copilot

In `.vscode/mcp.json`:

```json
{
  "servers": {
    "pendulum": {
      "type": "stdio",
      "command": "node",
      "args": ["dispatcher/index.js"],
      "env": {
        "PENDULUM_HOST": "localhost",
        "PENDULUM_PORT": "25566"
      }
    }
  }
}
```

### Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pendulum": {
      "command": "node",
      "args": ["path/to/pendulum/dispatcher/index.js"],
      "env": {
        "PENDULUM_HOST": "localhost",
        "PENDULUM_PORT": "25566"
      }
    }
  }
}
```

## Workflow

```
AI Client (Copilot/Claude)
       │
       │ stdio (MCP protocol)
       ▼
┌──────────────────────────┐
│  Pendulum Dispatcher      │  ← You are here
│  - Static tool list       │
│  - Health check           │
│  - Request forwarding     │
└────────┬─────────────────┘
         │
         │ TCP (JSON-RPC 2.0)
         ▼
┌──────────────────────────┐
│  Minecraft + Pendulum     │
│  (localhost:25566)        │
└──────────────────────────┘
```

## Error Handling

When Minecraft is not running, the AI client will receive:

```
Pendulum MCP server is not reachable (127.0.0.1:25566).

Reason: Connection timed out — Minecraft may not be running

Please ensure:
1. Minecraft is running
2. The Pendulum mod is installed
3. MCP server is started: /pendulum mcp start

Then retry your request.
```

## Notes

- **No automatic game launch**: You need to manually start Minecraft and run `/pendulum mcp start`
- **Independent connection per request**: Uses short-lived connections to avoid state issues with persistent TCP connections
- **120s timeout**: The `script/eval` timeout matches the backend
