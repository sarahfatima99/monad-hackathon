import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { api } from "../lib/api";
import { CONTRACT_ADDRESS, memoryGameAbi } from "../lib/wagmi";

function useCountdown(startTimeSec: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, startTimeSec * 1000 - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, done: diff === 0 };
}

function statusLabel(status: string, countdownDone: boolean) {
  if (status === "finished") return "Finished";
  if (status === "cancelled") return "Cancelled";
  if (status === "live" || countdownDone) return "Live";
  return "Registration open";
}

function GameCard({ game }: { game: Awaited<ReturnType<typeof api.games>>["games"][number] }) {
  const { label, done } = useCountdown(game.startTime);
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [joined, setJoined] = useState(false);

  async function handleJoin() {
    if (!address) return alert("Connect your wallet on the Account page first.");
    try {
      // On-chain game id is assumed to match the numeric suffix the organizer configured;
      // in production this comes from the /games list response.
      const onchainGameId = BigInt((game as any).onchainGameId ?? 0);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: memoryGameAbi,
        functionName: "joinGame",
        args: [onchainGameId]
      });
      await api.joinGame(game.id, hash);
      setJoined(true);
    } catch (e: any) {
      alert(e.message ?? "Failed to join");
    }
  }

  const status = statusLabel(game.status, done);

  return (
    <div className="card space-y-2">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold">{game.name}</h3>
        <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">{status}</span>
      </div>
      <p className="text-emerald-400 text-lg font-mono">{done ? "Starting…" : `Starts in ${label}`}</p>
      <p className="text-sm text-slate-400">
        {game.participantCount} registered players · Prize pool: {Number(formatEther(BigInt(game.poolWei))).toFixed(2)} MON
      </p>
      {joined ? (
        <Link className="btn-primary inline-block" to={`/games/${game.id}/lobby`}>
          Enter lobby
        </Link>
      ) : status === "Registration open" ? (
        <button className="btn-primary" disabled={isPending} onClick={handleJoin}>
          {isPending ? "Joining…" : "Join game"}
        </button>
      ) : (
        <Link className="btn-primary inline-block" to={`/games/${game.id}/lobby`}>
          {status === "Finished" ? "View results" : "Enter lobby"}
        </Link>
      )}
    </div>
  );
}

export function GamesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["games"], queryFn: api.games, refetchInterval: 10000 });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Upcoming games</h1>
      {isLoading && <p className="text-slate-400">Loading…</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        {data?.games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
    </div>
  );
}
