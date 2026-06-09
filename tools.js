/**
 * Pendulum MCP Tool Definitions
 * 
 * Copied from the Pendulum mod's MCP server to ensure AI clients always
 * see the full tool list even when the backend is unavailable.
 * 
 * Structure: { name, description, inputSchema: { type, properties, required } }
 */

export const TOOL_DEFINITIONS = [
  // ═══════════════════════════════════════════
  // Script Engine (script/*)
  // ═══════════════════════════════════════════
  {
    name: "script/eval",
    description: "Execute JavaScript code in Minecraft. Key globals: mc/minecraft/game. API: mc.player.* (movement, rotation, interaction, state), mc.world.* (blocks, entities, environment), mc.inv.* (inventory, container), mc.gui.* (screen click, type, enumerate widgets). All functions are synchronous. BARITONE: if installed, prefer br.* (br.goto, br.mine, br.follow, br.stop, br.isActive, br.command).",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JS code. E.g.: mc.player.forward(20); for(let b of mc.world.findBlocks('diamond_ore',16)) mc.player.breakBlockAt(b.x,b.y,b.z); JSON.stringify(mc.inv.getAllItems()); mc.world.rayTrace(5). If baritone: br.goto(100,64,200); br.mine('diamond_ore',64);" }
      },
      required: ["code"]
    }
  },
  {
    name: "script/evalAsync",
    description: "Execute JavaScript asynchronously — returns immediately. Use 'script/status' to check completion. For scripts longer than 120s.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JS code to execute asynchronously." }
      },
      required: ["code"]
    }
  },
  {
    name: "script/status",
    description: "Check if a script is currently running.",
    inputSchema: {
      type: "object",
      properties: {
        _: { type: "string", description: "No parameters required" }
      }
    }
  },
  {
    name: "script/abort",
    description: "Abort the currently running script.",
    inputSchema: {
      type: "object",
      properties: {
        _: { type: "string", description: "No parameters required" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // Pendulum Core
  // ═══════════════════════════════════════════
  {
    name: "health",
    description: "Health check: reports screenshot capability, keyboard injection, Baritone availability, and script state.",
    inputSchema: {
      type: "object",
      properties: {
        _: { type: "string", description: "No parameters required" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // GUI (gui/*)
  // ═══════════════════════════════════════════
  {
    name: "gui/screenshot",
    description: "Capture a screenshot with coordinate grid overlay. Returns base64 PNG. Use optional 'path' to also save to disk.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to save. Omit for base64 return only." }
      }
    }
  },
  {
    name: "gui/enumerateWidgets",
    description: "Recursively enumerate ALL GUI widgets including nested children. Returns [{type, text?, x, y, width, height, active?, focused?, children?}, ...].",
    inputSchema: {
      type: "object",
      properties: {
        _: { type: "string", description: "No parameters required" }
      }
    }
  },
  {
    name: "gui/guiElements",
    description: "Get flat list of non-slot GUI elements (buttons, labels). Returns [{type, x, y, width, height, text?}].",
    inputSchema: {
      type: "object",
      properties: {
        _: { type: "string", description: "No parameters required" }
      }
    }
  },
  {
    name: "gui/clickButton",
    description: "Find a button/widget by text substring or type name and click its center. Searches recursively. Returns widget info.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Text to match (substring, case-insensitive) or widget type name." }
      },
      required: ["target"]
    }
  },

  // ═══════════════════════════════════════════
  // Simulate Input (simulate/*)
  // ═══════════════════════════════════════════
  {
    name: "simulate/click",
    description: "Click at screen coordinates. Use after 'gui/screenshot' to target UI elements. Screenshot includes a coordinate grid.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "integer", description: "X coordinate in screen pixels." },
        y: { type: "integer", description: "Y coordinate in screen pixels." },
        button: { type: "string", description: "Mouse button: 'left' (default), 'right', or 'middle'." }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "simulate/pressKey",
    description: "Press a keyboard key. Supports: W, Enter, ESC, SPACE, F3, A, etc. Can hold for N seconds.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key name, e.g. 'W', 'Enter', 'ESC', 'SPACE', 'F3'." },
        holdSeconds: { type: "number", description: "Duration to hold in seconds. Default 0 (press and release)." }
      },
      required: ["key"]
    }
  },
  {
    name: "simulate/typeText",
    description: "Type text into the focused text field character by character.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type." },
        pressEnter: { type: "boolean", description: "Press Enter after typing. Default false." }
      },
      required: ["text"]
    }
  },
  {
    name: "simulate/pasteText",
    description: "Type text quickly (same as typeText, for large blocks).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to paste." },
        pressEnter: { type: "boolean", description: "Press Enter after. Default false." }
      },
      required: ["text"]
    }
  },
  {
    name: "simulate/scroll",
    description: "Scroll mouse wheel. Positive = up, negative = down.",
    inputSchema: {
      type: "object",
      properties: {
        clicks: { type: "integer", description: "Number of scroll clicks." }
      },
      required: ["clicks"]
    }
  },
  {
    name: "simulate/hotkey",
    description: "Press a key combination. E.g. 'ctrl,s' or 'shift,f3'.",
    inputSchema: {
      type: "object",
      properties: {
        keys: { type: "string", description: "Comma-separated key names." }
      },
      required: ["keys"]
    }
  },
  {
    name: "simulate/mouseDrag",
    description: "Drag mouse from one point to another.",
    inputSchema: {
      type: "object",
      properties: {
        xStart: { type: "integer", description: "Start X." },
        yStart: { type: "integer", description: "Start Y." },
        xEnd: { type: "integer", description: "End X." },
        yEnd: { type: "integer", description: "End Y." },
        button: { type: "string", description: "Mouse button: 'left' (default), 'right', or 'middle'." }
      },
      required: ["xStart", "yStart", "xEnd", "yEnd"]
    }
  },
  {
    name: "simulate/callScreenMethod",
    description: "DANGEROUS — Call an arbitrary no-arg method on the current GUI screen via reflection. All exceptions caught.",
    inputSchema: {
      type: "object",
      properties: {
        method: { type: "string", description: "Method name to call on the screen object." }
      },
      required: ["method"]
    }
  },
  {
    name: "simulate/selectListItem",
    description: "Select an item from a dropdown/list widget by text substring (case-insensitive).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text substring to match." }
      },
      required: ["text"]
    }
  },

  // ═══════════════════════════════════════════
  // Utility
  // ═══════════════════════════════════════════
  {
    name: "wait",
    description: "Wait for N seconds. Useful for sequencing actions.",
    inputSchema: {
      type: "object",
      properties: {
        seconds: { type: "number", description: "Seconds to wait. Default 1.0." }
      }
    }
  },

  // ═══════════════════════════════════════════
  // Video (video/*)
  // ═══════════════════════════════════════════
  {
    name: "video/start",
    description: "EXPERIMENTAL — Start ~10fps video capture. Reads GPU every 6 frames — expensive. Prefer 'gui/screenshot' for single shots.",
    inputSchema: {
      type: "object",
      properties: {
        _: { type: "string", description: "No parameters required" }
      }
    }
  },
  {
    name: "video/stop",
    description: "Stop video frame capture.",
    inputSchema: {
      type: "object",
      properties: {
        _: { type: "string", description: "No parameters required" }
      }
    }
  },
  {
    name: "video/frame",
    description: "Get latest cached video frame as base64 PNG. Error if no recent frame (< 5s).",
    inputSchema: {
      type: "object",
      properties: {
        _: { type: "string", description: "No parameters required" }
      }
    }
  }
];
