import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { newWebSocketRpcSession } from "capnweb";

export const Route = createFileRoute("/auction")({
  component: AuctionHouse,
});

interface AuctionAPI {
  joinAuction(username: string, notificationCallback: Function): Promise<any>;
  placeBid(amount: number): Promise<any>;
  getCurrentAuction(): Promise<any>;
  getAuctionHistory(): Promise<any>;
  pollMessages(): Promise<any[]>;
}

interface AuctionItem {
  id: string;
  name: string;
  description: string;
  movie: string;
  startingPrice: number;
  imageUrl?: string;
  rarity: "common" | "rare" | "legendary";
}

interface CurrentBid {
  amount: number;
  bidder: string;
  timestamp: string;
}

interface AuctionState {
  item: AuctionItem | null;
  currentBid: CurrentBid | null;
  timeRemaining: number;
  status: "waiting" | "active" | "ended";
  bidCount: number;
}

function AuctionHouse() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [auctionState, setAuctionState] = useState<AuctionState>({
    item: null,
    currentBid: null,
    timeRemaining: 0,
    status: "waiting",
    bidCount: 0,
  });
  const [bidAmount, setBidAmount] = useState("");
  const [notifications, setNotifications] = useState<
    Array<{
      type: string;
      message: string;
      timestamp: string;
      className?: string;
    }>
  >([]);
  const [auctionHistory, setAuctionHistory] = useState<any[]>([]);

  const apiRef = useRef<AuctionAPI | null>(null);
  const notificationsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottomNotifications = () => {
    notificationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottomNotifications();
  }, [notifications]);

  // Polling for messages when connected and joined
  useEffect(() => {
    if (!apiRef.current || !isConnected || !isJoined) {
      return;
    }

    let pollInterval: NodeJS.Timeout;

    const startPolling = () => {
      console.log("🔄 Starting message polling...");

      const poll = async () => {
        try {
          const messages = await apiRef.current!.pollMessages();

          if (messages && messages.length > 0) {
            console.log(`📨 Received ${messages.length} messages from server`);

            messages.forEach((message) => {
              console.log(
                `📨 Processing message:`,
                message.type,
                message.message
              );

              // Add to notifications
              setNotifications((prev) => [
                ...prev,
                {
                  type: message.type || "info",
                  message: message.message,
                  timestamp: new Date(
                    message.timestamp || Date.now()
                  ).toISOString(),
                  className: message.className,
                },
              ]);

              // Update auction state based on message type
              if (message.type === "bid_update") {
                setAuctionState((prev) => ({
                  ...prev,
                  currentBid: message.currentBid,
                  bidCount: message.bidCount,
                }));
              } else if (message.type === "timer_update") {
                setAuctionState((prev) => ({
                  ...prev,
                  timeRemaining: message.timeRemaining,
                }));
              } else if (message.type === "auction_start") {
                setAuctionState({
                  item: message.item,
                  currentBid: null,
                  timeRemaining: message.duration,
                  status: "active",
                  bidCount: 0,
                });
                // Refresh history
                apiRef.current?.getAuctionHistory().then(setAuctionHistory);
              } else if (message.type === "auction_end") {
                setAuctionState((prev) => ({
                  ...prev,
                  status: "ended",
                  timeRemaining: 0,
                }));
                if (message.winner && message.finalPrice) {
                  setAuctionHistory((prev) => [
                    ...prev,
                    {
                      name: auctionState?.item?.name || "Unknown Item",
                      finalPrice: message.finalPrice,
                      winner: message.winner,
                    },
                  ]);
                }
              }
            });
          }
        } catch (error) {
          console.error("❌ Polling error:", error);
        }
      };

      // Initial poll
      poll();

      // Set up interval polling every 1 second
      pollInterval = setInterval(poll, 1000);
    };

    startPolling();

    return () => {
      if (pollInterval) {
        console.log("🛑 Stopping message polling...");
        clearInterval(pollInterval);
      }
    };
  }, [isConnected, isJoined, auctionState?.item?.name]);

  const connect = () => {
    try {
      const protocol =
        typeof window !== "undefined" && window.location.protocol === "https:"
          ? "wss:"
          : "ws:";
      const wsUrl =
        typeof window !== "undefined"
          ? `${protocol}//${window.location.host}/api/websocket`
          : "ws://localhost:3000/api/websocket";

      console.log("Connecting to auction:", wsUrl);
      setConnectionStatus("Connecting...");

      const api = newWebSocketRpcSession(wsUrl) as any as AuctionAPI;
      apiRef.current = api;

      // Test connection
      api
        .getCurrentAuction()
        .then(() => {
          console.log("Auction RPC connection established");
          setIsConnected(true);
          setConnectionStatus("Connected");
        })
        .catch((error) => {
          console.error("Auction connection failed:", error);
          setConnectionStatus("Failed to connect");
        });
    } catch (error) {
      console.error("Failed to create auction session:", error);
      setConnectionStatus("Failed to connect");
    }
  };

  const joinAuction = async () => {
    if (apiRef.current && username.trim()) {
      try {
        // Use a simple dummy callback since we're now polling instead
        const dummyCallback = () => "polling-based";

        const result = await apiRef.current.joinAuction(
          username,
          dummyCallback
        );
        console.log("Joined auction:", result);

        setIsJoined(true);
        setNotifications([
          {
            type: "success",
            message: `Welcome to the Galactic Auction House, ${username}!`,
            timestamp: new Date().toISOString(),
            className: "bg-green-800 border-green-400",
          },
        ]);

        // Get current auction state
        const currentAuction = await apiRef.current.getCurrentAuction();
        if (currentAuction) {
          setAuctionState(currentAuction);
        }

        // Get auction history
        const history = await apiRef.current.getAuctionHistory();
        setAuctionHistory(history);
      } catch (error) {
        console.error("Failed to join auction:", error);
        setNotifications((prev) => [
          ...prev,
          {
            type: "error",
            message: `Failed to join auction: ${error}`,
            timestamp: new Date().toISOString(),
            className: "bg-red-800 border-red-400",
          },
        ]);
      }
    }
  };

  const placeBid = async () => {
    if (apiRef.current && bidAmount) {
      try {
        const amount = parseInt(bidAmount);
        const result = await apiRef.current.placeBid(amount);

        setNotifications((prev) => [
          ...prev,
          {
            type: "success",
            message: `Bid placed: $${amount}`,
            timestamp: new Date().toISOString(),
            className: "bg-blue-800 border-blue-400",
          },
        ]);

        setBidAmount("");
      } catch (error) {
        console.error("Failed to place bid:", error);
        setNotifications((prev) => [
          ...prev,
          {
            type: "error",
            message: `Bid failed: ${error}`,
            timestamp: new Date().toISOString(),
            className: "bg-red-800 border-red-400",
          },
        ]);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getMinBid = () => {
    if (!auctionState.currentBid) {
      return auctionState.item?.startingPrice || 0;
    }
    return auctionState.currentBid.amount + 10; // Minimum increment of $10
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "text-yellow-400 bg-yellow-900/20 border-yellow-400";
      case "rare":
        return "text-purple-400 bg-purple-900/20 border-purple-400";
      default:
        return "text-blue-400 bg-blue-900/20 border-blue-400";
    }
  };

  const getTimerColor = (seconds: number) => {
    if (seconds <= 10) return "text-red-400 animate-pulse";
    if (seconds <= 30) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            🚀 Galactic Auction House 🚀
          </h1>
          <p className="text-gray-300 text-lg">
            Legendary Sci-Fi Movie Memorabilia • Live Bidding • Real-Time Action
          </p>
        </div>

        {!isConnected ? (
          <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">Connect to Auction</h2>
              <button
                onClick={connect}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Connect to Galactic Network
              </button>
              <p className="text-sm text-gray-400 mt-2">
                Status: {connectionStatus}
              </p>
            </div>
          </div>
        ) : !isJoined ? (
          <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">Join the Auction</h2>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && joinAuction()}
                placeholder="Enter your galactic username"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <button
                onClick={joinAuction}
                disabled={!username.trim()}
                className="w-full px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Join Auction House
              </button>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Auction Display */}
            <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Current Auction</h2>
                <div
                  className={`text-3xl font-mono font-bold ${getTimerColor(
                    auctionState.timeRemaining
                  )}`}
                >
                  {auctionState.status === "active"
                    ? formatTime(auctionState.timeRemaining)
                    : auctionState.status === "ended"
                    ? "ENDED"
                    : "Waiting..."}
                </div>
              </div>

              {auctionState.item ? (
                <div className="bg-gray-900 rounded-lg p-6">
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0">
                      <div className="w-48 h-48 bg-gray-700 rounded-lg flex items-center justify-center">
                        <span className="text-6xl">🚀</span>
                      </div>
                    </div>

                    <div className="flex-grow">
                      <div
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium border mb-3 ${getRarityColor(
                          auctionState.item.rarity
                        )}`}
                      >
                        {auctionState.item.rarity.toUpperCase()}
                      </div>

                      <h3 className="text-2xl font-bold mb-2">
                        {auctionState.item.name}
                      </h3>
                      <p className="text-blue-400 mb-3 font-semibold">
                        From: {auctionState.item.movie}
                      </p>
                      <p className="text-gray-300 mb-4">
                        {auctionState.item.description}
                      </p>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                          <span className="text-gray-400 text-sm">
                            Starting Price:
                          </span>
                          <div className="text-xl font-bold text-green-400">
                            ${auctionState.item.startingPrice}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">
                            Total Bids:
                          </span>
                          <div className="text-xl font-bold text-purple-400">
                            {auctionState.bidCount}
                          </div>
                        </div>
                      </div>

                      {auctionState.currentBid ? (
                        <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 border border-green-500/50 rounded-lg p-4 mb-4">
                          <div className="text-sm text-gray-300 mb-1">
                            Current Highest Bid:
                          </div>
                          <div className="text-3xl font-bold text-green-400">
                            ${auctionState.currentBid.amount}
                          </div>
                          <div className="text-sm text-gray-400">
                            by {auctionState.currentBid.bidder}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-700 rounded-lg p-4 mb-4">
                          <div className="text-lg text-gray-300">
                            No bids yet - be the first!
                          </div>
                        </div>
                      )}

                      {auctionState.status === "active" && (
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && placeBid()}
                            placeholder={`Min bid: $${getMinBid()}`}
                            min={getMinBid()}
                            className="flex-grow px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                          <button
                            onClick={placeBid}
                            disabled={
                              !bidAmount || parseInt(bidAmount) < getMinBid()
                            }
                            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-bold"
                          >
                            PLACE BID
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg p-8 text-center">
                  <div className="text-6xl mb-4">⏳</div>
                  <h3 className="text-xl font-bold mb-2">
                    Preparing Next Auction...
                  </h3>
                  <p className="text-gray-400">
                    Stand by for galactic treasures!
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Live Notifications */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Live Activity</h3>
                <div className="h-64 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      Waiting for auction activity...
                    </p>
                  ) : (
                    notifications.slice(-10).map((notification, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border-l-4 ${
                          notification.className ||
                          "bg-gray-700 border-gray-400"
                        }`}
                      >
                        <div className="text-sm font-medium">
                          {notification.message}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(
                            notification.timestamp
                          ).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={notificationsEndRef} />
                </div>
              </div>

              {/* Auction History */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Recent Sales</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {auctionHistory.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">
                      No completed auctions yet
                    </p>
                  ) : (
                    auctionHistory
                      .slice(-5)
                      .reverse()
                      .map((item, index) => (
                        <div key={index} className="bg-gray-900 rounded p-3">
                          <div className="text-sm font-medium">{item.name}</div>
                          <div className="text-green-400 font-bold">
                            ${item.finalPrice}
                          </div>
                          <div className="text-xs text-gray-400">
                            Sold to: {item.winner}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
