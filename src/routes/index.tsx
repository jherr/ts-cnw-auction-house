import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "../logo.svg";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div className="text-center">
      <header className="min-h-screen flex flex-col items-center justify-center bg-[#282c34] text-white text-[calc(10px+2vmin)]">
        <img
          src={logo}
          className="h-[40vmin] pointer-events-none animate-[spin_20s_linear_infinite]"
          alt="logo"
        />
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Cap'n Web RPC Demo
        </h1>
        <p className="text-xl mb-8 text-gray-300">
          Real-time bidirectional communication with Cap'n Web
        </p>
        <Link
          to="/auction"
          className="text-[#61dafb] hover:underline mt-4 inline-block bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 rounded-lg font-bold text-xl hover:from-purple-700 hover:to-blue-700 transition-all"
        >
          🚀 Enter Galactic Auction House 🚀
        </Link>
        <p className="text-sm text-gray-400 mt-8 max-w-md">
          Experience real-time multi-user bidding powered by Cap'n Web's
          bidirectional RPC technology
        </p>
      </header>
    </div>
  );
}
