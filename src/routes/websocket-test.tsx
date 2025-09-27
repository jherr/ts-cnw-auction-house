import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { newWebSocketRpcSession } from "capnweb";

export const Route = createFileRoute("/websocket-test")({
  ssr: false,
  component: WebSocketTest,
});

interface ServerAPI {
  hello(name: string): Promise<string>;
  echo(data: any): Promise<any>;
  registerCallback(callback: Function): Promise<string>;
  triggerCallbacks(message: string): Promise<any>;
  broadcastEvent(eventData: any): Promise<string>;
  getServerStats(): Promise<any>;
}

function WebSocketTest() {
  const [messages, setMessages] = useState<
    Array<{ type: string; data: any; timestamp?: string; source?: string }>
  >([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [serverStats, setServerStats] = useState<any>(null);
  const apiRef = useRef<ServerAPI | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/websocket`;

      console.log("Connecting to:", wsUrl);
      setConnectionStatus("Connecting...");

      // Create the RPC session
      const api = newWebSocketRpcSession(wsUrl) as any as ServerAPI;
      apiRef.current = api;

      // Test the connection by calling a method
      api
        .hello("Client")
        .then(() => {
          console.log("RPC connection established");
          setIsConnected(true);
          setConnectionStatus("Connected");

          // Register a callback that the server can call
          const clientCallback = (data: any) => {
            console.log("Server called client callback:", data);
            setMessages((prev) => [
              ...prev,
              {
                type: "server-callback",
                data,
                timestamp: new Date().toISOString(),
                source: "server",
              },
            ]);
            return `Client received: ${JSON.stringify(data)}`;
          };

          // Register the callback with the server
          api.registerCallback(clientCallback).then((result) => {
            console.log("Callback registered:", result);
            setMessages((prev) => [
              ...prev,
              {
                type: "system",
                data: "Client callback registered with server",
                timestamp: new Date().toISOString(),
                source: "system",
              },
            ]);
          });
        })
        .catch((error) => {
          console.error("RPC connection failed:", error);
          setConnectionStatus("Failed to connect");
          setMessages((prev) => [
            ...prev,
            {
              type: "error",
              data: `Connection failed: ${error.message}`,
              timestamp: new Date().toISOString(),
              source: "system",
            },
          ]);
        });
    } catch (error) {
      console.error("Failed to create RPC session:", error);
      setConnectionStatus("Failed to connect");
    }
  };

  const disconnect = () => {
    if (apiRef.current) {
      // Cap'n Web sessions don't have a direct disconnect method
      // The connection will be closed by the browser when we clear the reference
      apiRef.current = null;
      setIsConnected(false);
      setConnectionStatus("Disconnected");
      setMessages((prev) => [
        ...prev,
        {
          type: "system",
          data: "Disconnected from server",
          timestamp: new Date().toISOString(),
          source: "system",
        },
      ]);
    }
  };

  const sendMessage = async () => {
    if (apiRef.current && inputValue.trim()) {
      try {
        const message = {
          text: inputValue,
          timestamp: new Date().toISOString(),
        };

        // Add the outgoing message to our display
        setMessages((prev) => [
          ...prev,
          {
            type: "client-message",
            data: message,
            timestamp: new Date().toISOString(),
            source: "client",
          },
        ]);

        // Call the server's echo method
        const response = await apiRef.current.echo(message);

        // Add the response to our display
        setMessages((prev) => [
          ...prev,
          {
            type: "server-response",
            data: response,
            timestamp: new Date().toISOString(),
            source: "server",
          },
        ]);

        setInputValue("");
      } catch (error) {
        console.error("Failed to send message:", error);
        setMessages((prev) => [
          ...prev,
          {
            type: "error",
            data: `Failed to send message: ${error}`,
            timestamp: new Date().toISOString(),
            source: "system",
          },
        ]);
      }
    }
  };

  const testHello = async () => {
    if (apiRef.current) {
      try {
        const response = await apiRef.current.hello("Test User");
        setMessages((prev) => [
          ...prev,
          {
            type: "hello-response",
            data: response,
            timestamp: new Date().toISOString(),
            source: "server",
          },
        ]);
      } catch (error) {
        console.error("Hello failed:", error);
      }
    }
  };

  const triggerServerCallbacks = async () => {
    if (apiRef.current) {
      try {
        const response = await apiRef.current.triggerCallbacks(
          "Hello from client trigger!"
        );
        setMessages((prev) => [
          ...prev,
          {
            type: "callback-trigger-response",
            data: response,
            timestamp: new Date().toISOString(),
            source: "server",
          },
        ]);
      } catch (error) {
        console.error("Trigger callbacks failed:", error);
      }
    }
  };

  const broadcastEvent = async () => {
    if (apiRef.current) {
      try {
        const eventData = {
          eventType: "test-broadcast",
          message: "This is a broadcast event",
          timestamp: new Date().toISOString(),
        };
        const response = await apiRef.current.broadcastEvent(eventData);
        setMessages((prev) => [
          ...prev,
          {
            type: "broadcast-response",
            data: response,
            timestamp: new Date().toISOString(),
            source: "server",
          },
        ]);
      } catch (error) {
        console.error("Broadcast event failed:", error);
      }
    }
  };

  const getStats = async () => {
    if (apiRef.current) {
      try {
        const stats = await apiRef.current.getServerStats();
        setServerStats(stats);
        setMessages((prev) => [
          ...prev,
          {
            type: "server-stats",
            data: stats,
            timestamp: new Date().toISOString(),
            source: "server",
          },
        ]);
      } catch (error) {
        console.error("Get stats failed:", error);
      }
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Cap'n Web RPC Test
        </h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <span className="text-lg font-semibold">Status:</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isConnected
                    ? "bg-green-600 text-green-100"
                    : "bg-red-600 text-red-100"
                }`}
              >
                {connectionStatus}
              </span>
            </div>

            <div className="space-x-2">
              <button
                onClick={connect}
                disabled={isConnected}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Connect RPC
              </button>
              <button
                onClick={disconnect}
                disabled={!isConnected}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Disconnect
              </button>
              <button
                onClick={clearMessages}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Clear Messages
              </button>
            </div>
          </div>

          {/* RPC Action Buttons */}
          <div className="border-t border-gray-700 pt-4 mb-4">
            <h3 className="text-lg font-semibold mb-3">RPC Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={testHello}
                disabled={!isConnected}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
              >
                Test Hello
              </button>
              <button
                onClick={triggerServerCallbacks}
                disabled={!isConnected}
                className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
              >
                Trigger Callbacks
              </button>
              <button
                onClick={broadcastEvent}
                disabled={!isConnected}
                className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
              >
                Broadcast Event
              </button>
              <button
                onClick={getStats}
                disabled={!isConnected}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
              >
                Get Server Stats
              </button>
            </div>
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              disabled={!isConnected}
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendMessage}
              disabled={!isConnected || !inputValue.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Send
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Messages Panel */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">RPC Messages</h2>
            <div className="h-96 overflow-y-auto bg-gray-900 rounded-lg p-4 space-y-2">
              {messages.length === 0 ? (
                <p className="text-gray-400 text-center">
                  No messages yet. Connect and try some RPC calls!
                </p>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      message.source === "server"
                        ? "bg-blue-800 border-blue-400"
                        : message.source === "client"
                        ? "bg-green-800 border-green-400"
                        : message.source === "system"
                        ? "bg-gray-700 border-gray-400"
                        : message.type === "error"
                        ? "bg-red-800 border-red-400"
                        : "bg-purple-800 border-purple-400"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex space-x-2 text-sm">
                        <span className="font-medium capitalize text-gray-300">
                          {message.type.replace(/-/g, " ")}
                        </span>
                        {message.source && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              message.source === "server"
                                ? "bg-blue-600 text-blue-100"
                                : message.source === "client"
                                ? "bg-green-600 text-green-100"
                                : "bg-gray-600 text-gray-100"
                            }`}
                          >
                            {message.source}
                          </span>
                        )}
                      </div>
                      {message.timestamp && (
                        <span className="text-xs text-gray-400">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <div className="text-white">
                      {typeof message.data === "object" ? (
                        <pre className="text-sm overflow-x-auto">
                          {JSON.stringify(message.data, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-sm">{String(message.data)}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Server Stats Panel */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Server Stats</h2>
            {serverStats ? (
              <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Uptime:</span>
                    <span className="ml-2 font-mono">
                      {Math.floor(serverStats.uptime)}s
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Active Callbacks:</span>
                    <span className="ml-2 font-mono">
                      {serverStats.activeCallbacks}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Node Version:</span>
                    <span className="ml-2 font-mono">
                      {serverStats.nodeVersion}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Memory RSS:</span>
                    <span className="ml-2 font-mono">
                      {Math.round(serverStats.memoryUsage?.rss / 1024 / 1024)}MB
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Last updated:{" "}
                  {new Date(serverStats.timestamp).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg p-4 text-center text-gray-400">
                Click "Get Server Stats" to see server information
              </div>
            )}

            {/* Features Info */}
            <div className="mt-6 bg-gray-900 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">
                Cap'n Web Features Demo
              </h3>
              <ul className="text-sm space-y-1 text-gray-300">
                <li>
                  • <strong>Bidirectional RPC:</strong> Server can call client
                  callbacks
                </li>
                <li>
                  • <strong>Function References:</strong> Pass functions over
                  RPC
                </li>
                <li>
                  • <strong>Promise Pipelining:</strong> Chain calls efficiently
                </li>
                <li>
                  • <strong>Object Capability:</strong> Secure reference passing
                </li>
                <li>
                  • <strong>TypeScript Support:</strong> Fully typed APIs
                </li>
                <li>
                  • <strong>Real-time Events:</strong> Server-initiated
                  broadcasts
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-gray-400">
          <p>
            WebSocket endpoint:{" "}
            <code className="bg-gray-800 px-2 py-1 rounded">
              {typeof window !== "undefined"
                ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
                    window.location.host
                  }/api/websocket`
                : "ws://localhost:3000/api/websocket"}
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
