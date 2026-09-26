import { Link, Outlet, useLocation } from "react-router-dom";
import { PlayerBar } from "./PlayerBar";

export function Layout() {
  const location = useLocation();
  const tab = (path: string) =>
    `px-3 py-1.5 rounded-md text-sm font-medium ${
      location.pathname.startsWith(path) ? "bg-emerald-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="font-semibold text-lg">🧠 Monad Memory Challenge</div>
        <nav className="flex gap-2">
          <Link className={tab("/games")} to="/games">
            Games
          </Link>
          <Link className={tab("/account")} to="/account">
            Account
          </Link>
        </nav>
      </header>
      <PlayerBar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
