import { defineConfig, Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { WebSocketServer } from "ws";
import { RpcTarget, newWebSocketRpcSession } from "capnweb";

// RPC Server Implementation
class MyApiServer extends RpcTarget {
  private clientCallbacks: Set<Function> = new Set();

  // Basic echo method
  hello(name: string) {
    console.log(`Server received hello from: ${name}`);
    return `Hello, ${name}! Server time: ${new Date().toISOString()}`;
  }

  // Echo method that returns structured data
  echo(data: any) {
    console.log("Server received echo:", data);
    return {
      type: "echo",
      originalData: data,
      serverTime: new Date().toISOString(),
      message: "Echoed from server",
    };
  }

  // Method that accepts a callback from client
  registerCallback(callback: Function) {
    console.log("Server registered client callback");
    this.clientCallbacks.add(callback);
    return "Callback registered successfully";
  }

  // Method that calls all registered client callbacks
  async triggerCallbacks(message: string) {
    console.log(
      `Server triggering ${this.clientCallbacks.size} callbacks with: ${message}`
    );
    const results = [];

    for (const callback of this.clientCallbacks) {
      try {
        const result = await callback({
          message,
          serverTime: new Date().toISOString(),
          type: "server-initiated-call",
        });
        results.push(result);
      } catch (error) {
        console.error("Error calling client callback:", error);
        results.push({ error: "Callback failed" });
      }
    }

    return {
      message: "All callbacks triggered",
      results,
      callbackCount: this.clientCallbacks.size,
    };
  }

  // Method to simulate server-initiated events
  async broadcastEvent(eventData: any) {
    console.log("Server broadcasting event:", eventData);

    for (const callback of this.clientCallbacks) {
      try {
        // Fire and forget - don't await
        callback({
          type: "broadcast",
          event: eventData,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error broadcasting to client:", error);
      }
    }

    return `Broadcasted to ${this.clientCallbacks.size} clients`;
  }

  // Method to get server stats
  getServerStats() {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      activeCallbacks: this.clientCallbacks.size,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  }
}

// Custom WebSocket RPC plugin
function websocketRpcPlugin(): Plugin {
  return {
    name: "websocket-rpc-plugin",
    configureServer(server) {
      if (!server.httpServer) return;

      const wss = new WebSocketServer({
        noServer: true,
      });

      server.httpServer.on("upgrade", (request, socket, head) => {
        const pathname = new URL(request.url!, `http://${request.headers.host}`)
          .pathname;

        // Only handle our specific websocket path
        if (pathname === "/api/websocket") {
          wss.handleUpgrade(request, socket, head, (ws) => {
            console.log(
              "WebSocket RPC connection established on /api/websocket"
            );

            // Create a new RPC server instance for this connection
            const apiServer = new MyApiServer();

            // Set up Cap'n Web RPC over this websocket
            // Cast to any to handle Node.js WebSocket vs Browser WebSocket interface differences
            newWebSocketRpcSession(ws as any, apiServer);
          });
        }
        // Don't destroy other upgrade requests - let them pass through
      });
    },
  };
}

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    websocketRpcPlugin(),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        format: "es",
      },
    },
  },
  esbuild: {
    target: "es2022",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
});

export default config;
