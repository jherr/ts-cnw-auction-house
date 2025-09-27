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
        <p>
          Edit <code>src/routes/index.tsx</code> and save to reload.
        </p>
        <a
          className="text-[#61dafb] hover:underline"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <a
          className="text-[#61dafb] hover:underline"
          href="https://tanstack.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn TanStack
        </a>
        <Link
          to="/websocket-test"
          className="text-[#61dafb] hover:underline mt-4 inline-block mr-4"
        >
          WebSocket Test
        </Link>
        <Link
          to="/auction"
          className="text-[#61dafb] hover:underline mt-4 inline-block bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 rounded-lg font-bold"
        >
          🚀 Galactic Auction House 🚀
        </Link>
      </header>
    </div>
  );
}
