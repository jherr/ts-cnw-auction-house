import { defineConfig, Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { WebSocketServer } from "ws";

// Custom WebSocket plugin
function websocketPlugin(): Plugin {
  return {
    name: "websocket-plugin",
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
            wss.emit("connection", ws, request);
          });
        }
        // Don't destroy other upgrade requests - let them pass through
      });

      wss.on("connection", (ws, _request) => {
        console.log("WebSocket connection established on /api/websocket");

        // Send a welcome message
        ws.send(
          JSON.stringify({
            type: "welcome",
            message: "Connected to websocket server!",
          })
        );

        // Handle incoming messages
        ws.on("message", (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log("Received message:", message);

            // Echo the message back
            ws.send(
              JSON.stringify({
                type: "echo",
                data: message,
                timestamp: new Date().toISOString(),
              })
            );
          } catch (error) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid JSON format",
              })
            );
          }
        });

        // Handle connection close
        ws.on("close", () => {
          console.log("WebSocket connection closed");
        });

        // Handle errors
        ws.on("error", (error) => {
          console.error("WebSocket error:", error);
        });
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
    websocketPlugin(),
  ],
  server: {
    port: 3000,
    host: true,
  },
});

export default config;
