import { defineConfig, Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { WebSocketServer } from "ws";
import { RpcTarget, newWebSocketRpcSession } from "capnweb";

// Sci-Fi Memorabilia Auction Items
const AUCTION_ITEMS = [
  {
    id: "luke-lightsaber",
    name: "Luke Skywalker's Lightsaber",
    description:
      "The iconic blue lightsaber wielded by Luke Skywalker in The Empire Strikes Back. Complete with authentic battle damage and force resonance.",
    movie: "Star Wars: The Empire Strikes Back",
    startingPrice: 50000,
    rarity: "legendary" as const,
  },
  {
    id: "tricorder-tos",
    name: "Original Series Tricorder",
    description:
      "Spock's personal tricorder from the original Star Trek series. Fully functional scanning capabilities for 23rd century technology.",
    movie: "Star Trek: The Original Series",
    startingPrice: 25000,
    rarity: "rare" as const,
  },
  {
    id: "replicant-badge",
    name: "Blade Runner Police Badge",
    description:
      "Rick Deckard's LAPD badge from Blade Runner circa 2019. Includes encrypted access to the Tyrell Corporation database.",
    movie: "Blade Runner",
    startingPrice: 15000,
    rarity: "rare" as const,
  },
  {
    id: "neo-pills",
    name: "The Red and Blue Pills",
    description:
      "Morpheus's choice pills from The Matrix. Sealed in original quantum-encrypted containers. Choose wisely.",
    movie: "The Matrix",
    startingPrice: 100000,
    rarity: "legendary" as const,
  },
  {
    id: "phaser-kirk",
    name: "Captain Kirk's Phaser",
    description:
      "Type-2 phaser used by Captain James T. Kirk. Set to stun, but packs a punch that can take down a Klingon warrior.",
    movie: "Star Trek: The Original Series",
    startingPrice: 30000,
    rarity: "rare" as const,
  },
  {
    id: "flux-capacitor",
    name: "Flux Capacitor",
    description:
      "The legendary flux capacitor that makes time travel possible. From Doc Brown's DeLorean. 1.21 gigawatts not included.",
    movie: "Back to the Future",
    startingPrice: 75000,
    rarity: "legendary" as const,
  },
];

interface AuctionBid {
  amount: number;
  bidder: string;
  timestamp: string;
}

interface AuctionState {
  item: (typeof AUCTION_ITEMS)[0] | null;
  currentBid: AuctionBid | null;
  timeRemaining: number;
  status: "waiting" | "active" | "ended";
  bidCount: number;
  startTime: number;
}

// Shared auction state across all connections
class SharedAuctionState {
  clients: Map<string, Function> = new Map();
  auctionState: AuctionState = {
    item: null,
    currentBid: null,
    timeRemaining: 0,
    status: "waiting",
    bidCount: 0,
    startTime: 0,
  };
  auctionHistory: Array<{
    name: string;
    finalPrice: number;
    winner: string;
  }> = [];
  currentItemIndex = 0;
  auctionTimer: NodeJS.Timeout | null = null;
  timerInterval: NodeJS.Timeout | null = null;
  initialized = false;

  initialize() {
    if (!this.initialized) {
      this.initialized = true;
      console.log("🚀 Starting shared auction system...");
      // Start first auction after 5 seconds
      setTimeout(() => this.startNewAuction(), 5000);

      // Periodically clean up dead connections (every 10 minutes)
      setInterval(() => this.cleanupDeadConnections(), 10 * 60 * 1000);
    }
  }

  async startNewAuction() {
    // Clear any existing timers
    if (this.auctionTimer) clearTimeout(this.auctionTimer);
    if (this.timerInterval) clearInterval(this.timerInterval);

    // Get next item
    const item = AUCTION_ITEMS[this.currentItemIndex % AUCTION_ITEMS.length];
    this.currentItemIndex++;

    // Reset auction state
    this.auctionState = {
      item,
      currentBid: null,
      timeRemaining: 120, // 2 minutes
      status: "active",
      bidCount: 0,
      startTime: Date.now(),
    };

    console.log(`Starting auction for: ${item.name}`);

    // Broadcast auction start
    await this.broadcastToAll({
      type: "auction_start",
      message: `NEW AUCTION: ${item.name} from ${item.movie}!`,
      item,
      duration: this.auctionState.timeRemaining,
      className: "bg-purple-800 border-purple-400",
    });

    // Start countdown timer
    this.startCountdown();

    // Set auction end timer
    this.auctionTimer = setTimeout(() => {
      this.endAuction();
    }, this.auctionState.timeRemaining * 1000);
  }

  startCountdown() {
    this.timerInterval = setInterval(async () => {
      if (this.auctionState.timeRemaining > 0) {
        this.auctionState.timeRemaining--;

        // Send timer updates every 10 seconds, or every second in last 10 seconds
        if (
          this.auctionState.timeRemaining % 10 === 0 ||
          this.auctionState.timeRemaining <= 10
        ) {
          await this.broadcastToAll({
            type: "timer_update",
            message: `${this.auctionState.timeRemaining} seconds remaining`,
            timeRemaining: this.auctionState.timeRemaining,
          });
        }
      }
    }, 1000);
  }

  async endAuction() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.auctionState.status = "ended";
    this.auctionState.timeRemaining = 0;

    if (this.auctionState.currentBid && this.auctionState.item) {
      // Add to history
      this.auctionHistory.push({
        name: this.auctionState.item.name,
        finalPrice: this.auctionState.currentBid.amount,
        winner: this.auctionState.currentBid.bidder,
      });

      // Announce winner
      await this.broadcastToAll({
        type: "auction_end",
        message: `SOLD! ${this.auctionState.item.name} goes to ${this.auctionState.currentBid.bidder} for $${this.auctionState.currentBid.amount}!`,
        winner: this.auctionState.currentBid.bidder,
        finalPrice: this.auctionState.currentBid.amount,
        className: "bg-green-800 border-green-400",
      });
    } else {
      // No bids
      await this.broadcastToAll({
        type: "auction_end",
        message: `Auction ended with no bids. ${this.auctionState.item?.name} returns to the vault.`,
        className: "bg-red-800 border-red-400",
      });
    }

    console.log(
      `Auction ended. Winner: ${this.auctionState.currentBid?.bidder || "None"}`
    );

    // Start next auction in 10 seconds
    setTimeout(() => this.startNewAuction(), 10000);
  }

  async broadcastToAll(notification: any, excludeUser?: string) {
    // Use the new message queue-based broadcasting approach
    console.log(
      `🎯 SharedAuctionState broadcasting to ${this.clients.size} registered users`
    );
    return await AuctionServer.broadcastViaMessageQueue(
      notification,
      excludeUser
    );
  }

  async cleanupDeadConnections() {
    if (this.clients.size === 0) return;

    console.log(`🔍 Health check: Testing ${this.clients.size} connections...`);
    const disconnectedUsers: string[] = [];

    const promises = Array.from(this.clients.entries()).map(
      async ([username, callback]) => {
        try {
          // Send a ping notification to test if the connection is alive
          await callback({
            type: "ping",
            message: "connection health check",
            silent: true,
          });
          return { username, alive: true };
        } catch (error) {
          this.clients.delete(username);
          disconnectedUsers.push(username);
          return { username, alive: false };
        }
      }
    );

    await Promise.allSettled(promises);

    // Notify remaining clients about disconnections
    if (disconnectedUsers.length > 0) {
      console.log(
        `🔌 Cleaned up ${
          disconnectedUsers.length
        } dead connections: ${disconnectedUsers.join(", ")}`
      );

      for (const username of disconnectedUsers) {
        await this.broadcastToAll({
          type: "user_left",
          message: `${username} left the auction house`,
          className: "bg-gray-700 border-gray-400",
        });
      }
    }
  }
}

// Global shared auction instance
const globalAuction = new SharedAuctionState();

// Global registry of active RPC server instances
const activeServers = new Set<AuctionServer>();

// Global registry of WebSocket connections for direct broadcasting
const activeWebSockets = new Map<string, WebSocket>();

// Message queue system for each user
const userMessageQueues = new Map<string, Array<any>>();

// Auction Server Implementation (one per connection)
class AuctionServer extends RpcTarget {
  private currentUsername: string | null = null;
  private clientCallback: Function | null = null;
  private webSocket: WebSocket | null = null;

  constructor() {
    super();
    // Initialize the shared auction system if not already done
    globalAuction.initialize();

    // Register this server instance
    activeServers.add(this);
    console.log(`📡 Registered new RPC server. Total: ${activeServers.size}`);
  }

  // Set the WebSocket connection for this server instance
  setWebSocket(ws: WebSocket) {
    this.webSocket = ws;

    // Handle WebSocket disconnection
    ws.on("close", () => {
      if (this.currentUsername) {
        activeWebSockets.delete(this.currentUsername);
        console.log(`🔌 WebSocket disconnected for ${this.currentUsername}`);
      }
      this.dispose();
    });
  }

  // Message queue-based broadcasting (avoids RPC cross-session issues)
  static async broadcastViaMessageQueue(
    notification: any,
    excludeUser?: string
  ) {
    console.log(`📬 Broadcasting via message queue to registered users`);

    let successCount = 0;
    const successful: string[] = [];

    for (const username of globalAuction.clients.keys()) {
      if (excludeUser && username === excludeUser) {
        continue;
      }

      // Add notification to user's message queue
      if (!userMessageQueues.has(username)) {
        userMessageQueues.set(username, []);
      }

      const queue = userMessageQueues.get(username)!;
      queue.push({
        ...notification,
        timestamp: Date.now(),
        id: Math.random().toString(36).substr(2, 9),
      });

      // Keep queue size manageable (last 50 messages)
      if (queue.length > 50) {
        queue.splice(0, queue.length - 50);
      }

      successCount++;
      successful.push(username);
      console.log(`✅ Message queued for ${username}`);
    }

    console.log(
      `📬 Message queue broadcast: ${successCount} users notified (${successful.join(
        ", "
      )})`
    );
    return { successful, failed: [], successCount, failedCount: 0 };
  }

  // Cleanup when connection closes
  dispose() {
    activeServers.delete(this);
    if (this.currentUsername) {
      globalAuction.clients.delete(this.currentUsername);
    }
    console.log(`📡 Unregistered RPC server. Total: ${activeServers.size}`);
  }

  // Client joins the auction
  async joinAuction(username: string, notificationCallback: Function) {
    console.log(`${username} joined the auction`);
    this.currentUsername = username;

    // Store callback locally in this server instance
    this.clientCallback = notificationCallback;

    // Register WebSocket in global map for direct broadcasting
    if (this.webSocket) {
      activeWebSockets.set(username, this.webSocket);
      console.log(
        `🔌 Registered WebSocket for ${username}. Total: ${activeWebSockets.size}`
      );
    }

    // Also track in global state for counting
    globalAuction.clients.set(username, notificationCallback);

    // Send welcome notification via message queue
    AuctionServer.broadcastViaMessageQueue(
      {
        type: "welcome",
        message: `Welcome ${username}! Get ready for legendary sci-fi treasures!`,
        className: "bg-blue-800 border-blue-400",
      },
      undefined
    );

    // Broadcast that someone joined using new approach
    await this.broadcastToAllServers(
      {
        type: "user_joined",
        message: `${username} entered the auction house`,
        className: "bg-gray-700 border-gray-400",
      },
      username
    );

    return {
      message: "Successfully joined the auction",
      activeUsers: activeServers.size,
    };
  }

  // New broadcast method that works across RPC sessions
  async broadcastToAllServers(notification: any, excludeUser?: string) {
    // Use the new message queue-based broadcasting
    return await AuctionServer.broadcastViaMessageQueue(
      notification,
      excludeUser
    );
  }

  // Get current auction state
  getCurrentAuction() {
    return globalAuction.auctionState;
  }

  // Get auction history
  getAuctionHistory() {
    return globalAuction.auctionHistory;
  }

  // Poll for new messages from the queue
  async pollMessages() {
    if (!this.currentUsername) {
      return [];
    }

    const queue = userMessageQueues.get(this.currentUsername) || [];
    const messages = [...queue]; // Return copy

    // Clear the queue after reading
    userMessageQueues.set(this.currentUsername, []);

    if (messages.length > 0) {
      console.log(
        `📨 ${this.currentUsername} polling: returning ${messages.length} messages`
      );
    }

    return messages;
  }

  // Place a bid
  async placeBid(amount: number) {
    const bidder = this.currentUsername || "Anonymous";

    if (globalAuction.auctionState.status !== "active") {
      throw new Error("No active auction");
    }

    if (!globalAuction.auctionState.item) {
      throw new Error("No item being auctioned");
    }

    const minBid = globalAuction.auctionState.currentBid
      ? globalAuction.auctionState.currentBid.amount + 10
      : globalAuction.auctionState.item.startingPrice;

    if (amount < minBid) {
      throw new Error(`Bid must be at least $${minBid}`);
    }

    // Update auction state
    globalAuction.auctionState.currentBid = {
      amount,
      bidder,
      timestamp: new Date().toISOString(),
    };
    globalAuction.auctionState.bidCount++;

    console.log(`New bid: $${amount} by ${bidder}`);

    // Broadcast bid update to all clients using new approach
    await this.broadcastToAllServers({
      type: "bid_update",
      message: `${bidder} bid $${amount}!`,
      currentBid: globalAuction.auctionState.currentBid,
      bidCount: globalAuction.auctionState.bidCount,
      className:
        amount >= 50000
          ? "bg-yellow-800 border-yellow-400"
          : "bg-green-800 border-green-400",
    });

    // If less than 30 seconds remaining, extend timer
    if (globalAuction.auctionState.timeRemaining < 30) {
      globalAuction.auctionState.timeRemaining = Math.min(
        globalAuction.auctionState.timeRemaining + 10,
        60
      );
      await this.broadcastToAllServers({
        type: "timer_extended",
        message: `Time extended! ${globalAuction.auctionState.timeRemaining} seconds remaining.`,
        timeRemaining: globalAuction.auctionState.timeRemaining,
        className: "bg-orange-800 border-orange-400",
      });
    }

    return {
      message: "Bid placed successfully",
      currentBid: globalAuction.auctionState.currentBid,
      timeRemaining: globalAuction.auctionState.timeRemaining,
    };
  }

  // Start a new auction
  private async startNewAuction() {
    // Clear any existing timers
    if (this.auctionTimer) clearTimeout(this.auctionTimer);
    if (this.timerInterval) clearInterval(this.timerInterval);

    // Get next item
    const item = AUCTION_ITEMS[this.currentItemIndex % AUCTION_ITEMS.length];
    this.currentItemIndex++;

    // Reset auction state
    this.auctionState = {
      item,
      currentBid: null,
      timeRemaining: 120, // 2 minutes
      status: "active",
      bidCount: 0,
      startTime: Date.now(),
    };

    console.log(`Starting auction for: ${item.name}`);

    // Broadcast auction start
    await this.broadcastToAll({
      type: "auction_start",
      message: `NEW AUCTION: ${item.name} from ${item.movie}!`,
      item,
      duration: this.auctionState.timeRemaining,
      className: "bg-purple-800 border-purple-400",
    });

    // Start countdown timer
    this.startCountdown();

    // Set auction end timer
    this.auctionTimer = setTimeout(() => {
      this.endAuction();
    }, this.auctionState.timeRemaining * 1000);
  }

  // Start countdown timer updates
  private startCountdown() {
    this.timerInterval = setInterval(async () => {
      if (this.auctionState.timeRemaining > 0) {
        this.auctionState.timeRemaining--;

        // Send timer updates every 10 seconds, or every second in last 10 seconds
        if (
          this.auctionState.timeRemaining % 10 === 0 ||
          this.auctionState.timeRemaining <= 10
        ) {
          await this.broadcastToAll({
            type: "timer_update",
            message: `${this.auctionState.timeRemaining} seconds remaining`,
            timeRemaining: this.auctionState.timeRemaining,
          });
        }
      }
    }, 1000);
  }

  // End the current auction
  private async endAuction() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.auctionState.status = "ended";
    this.auctionState.timeRemaining = 0;

    if (this.auctionState.currentBid && this.auctionState.item) {
      // Add to history
      this.auctionHistory.push({
        name: this.auctionState.item.name,
        finalPrice: this.auctionState.currentBid.amount,
        winner: this.auctionState.currentBid.bidder,
      });

      // Announce winner
      await this.broadcastToAll({
        type: "auction_end",
        message: `SOLD! ${this.auctionState.item.name} goes to ${this.auctionState.currentBid.bidder} for $${this.auctionState.currentBid.amount}!`,
        winner: this.auctionState.currentBid.bidder,
        finalPrice: this.auctionState.currentBid.amount,
        className: "bg-green-800 border-green-400",
      });
    } else {
      // No bids
      await this.broadcastToAll({
        type: "auction_end",
        message: `Auction ended with no bids. ${this.auctionState.item?.name} returns to the vault.`,
        className: "bg-red-800 border-red-400",
      });
    }

    console.log(
      `Auction ended. Winner: ${this.auctionState.currentBid?.bidder || "None"}`
    );

    // Start next auction in 10 seconds
    setTimeout(() => this.startNewAuction(), 10000);
  }

  // Broadcast message to all connected clients
  private async broadcastToAll(notification: any, excludeUser?: string) {
    const activeClients = Array.from(this.clients.entries());
    const promises = activeClients.map(async ([username, callback]) => {
      if (excludeUser && username === excludeUser)
        return { username, success: true };

      try {
        await callback(notification);
        return { username, success: true };
      } catch (error) {
        // Check if this is a disposed RPC stub error
        if (error instanceof Error && error.message.includes("disposed")) {
          console.log(`🔌 Client ${username} disconnected (RPC stub disposed)`);
        } else {
          console.error(`Error notifying ${username}:`, error);
        }

        // Remove broken connections
        this.clients.delete(username);
        return { username, success: false, error };
      }
    });

    const results = await Promise.allSettled(promises);

    // Log successful broadcasts for debugging
    const successful = results
      .filter((r) => r.status === "fulfilled" && r.value.success)
      .map((r) => (r.status === "fulfilled" ? r.value.username : ""))
      .filter(Boolean);

    if (successful.length > 0) {
      console.log(
        `📢 Broadcasted to ${successful.length} clients: ${successful.join(
          ", "
        )}`
      );
    }
  }

  // Clean up dead connections by sending a ping
  private async cleanupDeadConnections() {
    if (this.clients.size === 0) return;

    console.log(`🔍 Health check: Testing ${this.clients.size} connections...`);
    const disconnectedUsers: string[] = [];

    const promises = Array.from(this.clients.entries()).map(
      async ([username, callback]) => {
        try {
          // Send a ping notification to test if the connection is alive
          await callback({
            type: "ping",
            message: "connection health check",
            silent: true, // This won't be displayed in the client UI
          });
          return { username, alive: true };
        } catch (error) {
          this.clients.delete(username);
          disconnectedUsers.push(username);
          return { username, alive: false };
        }
      }
    );

    await Promise.allSettled(promises);

    // Notify remaining clients about disconnections
    if (disconnectedUsers.length > 0) {
      console.log(
        `🔌 Cleaned up ${
          disconnectedUsers.length
        } dead connections: ${disconnectedUsers.join(", ")}`
      );

      for (const username of disconnectedUsers) {
        await this.broadcastToAll({
          type: "user_left",
          message: `${username} left the auction house`,
          className: "bg-gray-700 border-gray-400",
        });
      }
    }
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
            const apiServer = new AuctionServer();

            // Store WebSocket reference in server
            apiServer.setWebSocket(ws);

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
