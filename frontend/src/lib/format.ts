import { formatEther } from "viem";
import type { GameStatus } from "./api";

export function formatMon(wei: string | bigint | null | undefined, maxDecimals = 4) {
  if (wei === null || wei === undefined) return "—";
  const s = formatEther(BigInt(wei));
  const [whole, frac = ""] = s.split(".");
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  return `${Number(whole).toLocaleString()}${trimmed ? "." + trimmed : ""} MON`;
}

export function shortAddress(a?: string | null) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  return d > 0 ? `${d}d ${hms}` : hms;
}

/** "Today at 18:00", "Tomorrow at 09:30", or "Sat 3 Oct at 18:00" — in the player's timezone. */
export function formatStart(unixSeconds: number) {
  const date = new Date(unixSeconds * 1000);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return `Today at ${time}`;
  if (sameDay(date, tomorrow)) return `Tomorrow at ${time}`;
  return `${date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} at ${time}`;
}

export const STATUS_LABEL: Record<GameStatus, string> = {
  registration_open: "Registration open",
  starting_soon: "Starting soon",
  live: "Live",
  finished: "Finished",
  cancelled: "Cancelled"
};

export const STATUS_STYLE: Record<GameStatus, string> = {
  registration_open: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  starting_soon: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  live: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  finished: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  cancelled: "bg-slate-500/15 text-slate-400 ring-slate-500/30"
};

/** Turns wallet/viem errors into something a player can act on. */
export function friendlyError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; name?: string };
  const msg = e?.shortMessage ?? e?.message ?? String(err);
  if (/user rejected|denied|rejected the request/i.test(msg)) return "You cancelled the request in your wallet.";
  if (/insufficient funds/i.test(msg)) return "Not enough MON in your wallet to pay the network fee.";
  if (/registration closed/i.test(msg)) return "Registration for this game has closed.";
  if (/already registered/i.test(msg)) return "This wallet is already registered for this game.";
  if (/already claimed/i.test(msg)) return "You've already claimed this reward.";
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}
