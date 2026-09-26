import { Link, NavLink, Outlet } from "react-router-dom";
import { PlayerBar } from "./PlayerBar";
import { useAppConfig } from "../lib/hooks";

export function Layout() {
  const cfg = useAppConfig();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0a1a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-monad text-lg">🧠</span>
            <span className="hidden sm:inline">Monad Memory Challenge</span>
          </Link>
          <nav className="flex gap-1">
            <NavLink className={tab} to="/" end>Games</NavLink>
            <NavLink className={tab} to="/account">Account</NavLink>
          </nav>
        </div>
        <PlayerBar />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-500">
        Prize pools and payouts are enforced by a smart contract on {cfg.chainName}
        {cfg.contractAddress && cfg.explorerUrl && (
          <>
            {" · "}
            <a className="underline hover:text-slate-300" href={`${cfg.explorerUrl}/address/${cfg.contractAddress}`} target="_blank" rel="noreferrer">
              view contract
            </a>
          </>
        )}
        {" · "}
        <Link className="underline hover:text-slate-300" to="/admin">organizer</Link>
      </footer>
    </div>
  );
}
