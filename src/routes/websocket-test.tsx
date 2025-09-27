import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/websocket-test")({
  component: WebSocketTest,
});

function WebSocketTest() {
  const [messages, setMessages] = useState<
    Array<{ type: string; data: any; timestamp?: string }>
  >([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const wsRef = useRef<WebSocket | null>(null);
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
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/api/websocket`
      );

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setConnectionStatus("Connected");
        wsRef.current = ws;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setMessages((prev) => [...prev, message]);
        } catch (error) {
          setMessages((prev) => [...prev, { type: "raw", data: event.data }]);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        setConnectionStatus("Disconnected");
        wsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("Error");
        setMessages((prev) => [
          ...prev,
          { type: "error", data: "Connection error occurred" },
        ]);
      };
    } catch (error) {
      console.error("Failed to connect:", error);
      setConnectionStatus("Failed to connect");
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const sendMessage = () => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      inputValue.trim()
    ) {
      try {
        const message = {
          text: inputValue,
          timestamp: new Date().toISOString(),
        };
        wsRef.current.send(JSON.stringify(message));
        setInputValue("");
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">WebSocket Test</h1>

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
                Connect
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

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Messages</h2>
          <div className="h-96 overflow-y-auto bg-gray-900 rounded-lg p-4 space-y-2">
            {messages.length === 0 ? (
              <p className="text-gray-400 text-center">
                No messages yet. Connect and send a message to get started!
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    message.type === "welcome"
                      ? "bg-blue-800"
                      : message.type === "echo"
                      ? "bg-green-800"
                      : message.type === "error"
                      ? "bg-red-800"
                      : "bg-gray-700"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium capitalize text-gray-300">
                      {message.type}
                    </span>
                    {message.timestamp && (
                      <span className="text-xs text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-white">
                    {typeof message.data === "object" ? (
                      <pre className="text-sm">
                        {JSON.stringify(message.data, null, 2)}
                      </pre>
                    ) : typeof message.message === "string" ? (
                      message.message
                    ) : (
                      String(message.data || message)
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="mt-6 text-center text-gray-400">
          <p>
            WebSocket endpoint:{" "}
            <code className="bg-gray-800 px-2 py-1 rounded">
              {`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
                window.location.host
              }/api/websocket`}
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
