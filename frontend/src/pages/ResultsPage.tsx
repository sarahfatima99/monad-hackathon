import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api, getToken, type GameSummary } from "../lib/api";
import { useAppConfig, useContractTx } from "../lib/hooks";
import { formatMon, formatStart, friendlyError, shortAddress } from "../lib/format";

interface Results {
  game: GameSummary & { finalizeTx: string | null };
  ready: boolean;
  finalizeError: string | null;
  leaderboard: { rank: number; nickname: string; score: number; rewardWei: string; isMe: boolean }[];
  me: { score: number; rewardWei: string; proof: `0x${string}`[]; claimed: boolean; wallet: string } | null;
}

export function ResultsPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const cfg = useAppConfig();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const send = useContractTx();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const { data, error } = useQuery({
    queryKey: ["results", gameId, !!getToken()],
    queryFn: () => api<Results>(`/games/${gameId}/results`),
    refetchInterval: (q) => (q.state.data?.ready ? false : 3000)
  });

  // Once results are published, refresh the player bar ("Won" / "To claim").
  useEffect(() => {
    if (data?.ready) queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [data?.ready, queryClient]);

  async function claim() {
    if (!data?.me) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await send({ functionName: "claimReward", args: [BigInt(data.game.onchainGameId), BigInt(data.me.rewardWei), data.me.proof] });
      await queryClient.invalidateQueries();
    } catch (e) {
      setClaimError(friendlyError(e));
    } finally {
      setClaiming(false);
    }
  }

  if (error) return <p className="text-rose-300">{(error as Error).message}</p>;
  if (!data) return <p className="text-slate-400">Loading results…</p>;

  const { game, me } = data;
  const reward = me ? BigInt(me.rewardWei) : 0n;
  const wrongWallet = me && address && address.toLowerCase() !== me.wallet.toLowerCase();
  const perfect = game.roundsCount;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link to="/" className="text-sm text-slate-400 hover:text-white">← All games</Link>
        <h1 className="mt-1 text-2xl font-bold">{game.name} — results</h1>
        <p className="text-sm text-slate-400">
          Played {formatStart(game.startTime)} · Prize pool {formatMon(game.poolWei, 2)}
          {data.ready && game.finalizeTx && cfg.explorerUrl && (
            <> · <a className="underline" href={`${cfg.explorerUrl}/tx/${game.finalizeTx}`} target="_blank" rel="noreferrer">on-chain result</a></>
          )}
        </p>
      </div>

      {!data.ready && (
        <div className="card flex items-center gap-3 text-slate-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-monad border-t-transparent" />
          {data.game.status === "live" ? "The game is still in progress…" : "Grading answers and publishing the results on-chain…"}
        </div>
      )}

      {data.ready && me && (
        <div className={`card text-center ${reward > 0n ? "ring-2 ring-emerald-400/50" : ""}`}>
          <p className="text-sm text-slate-400">Your score</p>
          <p className="text-5xl font-bold">{me.score}<span className="text-2xl text-slate-500">/{perfect}</span></p>
          {reward > 0n ? (
            <div className="mt-4 space-y-3">
              <p className="text-lg">🎉 Perfect score! You won <b className="text-emerald-300">{formatMon(reward)}</b></p>
              {me.claimed ? (
                <p className="text-emerald-300">✓ Claimed to {shortAddress(me.wallet)}</p>
              ) : (
                <>
                  <button className="btn-primary" disabled={claiming || !!wrongWallet} onClick={claim}>
                    {claiming ? "Confirm in your wallet…" : `Claim ${formatMon(reward)}`}
                  </button>
                  {wrongWallet && <p className="text-xs text-amber-300">Switch your wallet to {shortAddress(me.wallet)} to claim.</p>}
                  {claimError && <p className="text-sm text-rose-300">{claimError}</p>}
                </>
              )}
            </div>
          ) : (
            <p className="mt-3 text-slate-400">
              {me.score === perfect ? "" : `You needed ${perfect}/${perfect} to share the prize. `}Better luck next game!
            </p>
          )}
        </div>
      )}

      {data.ready && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Leaderboard</h2>
          {data.leaderboard.length === 0 ? (
            <p className="text-slate-400">Nobody played this game.</p>
          ) : (
            <ol className="divide-y divide-white/5">
              {data.leaderboard.map((row, i) => (
                <li key={i} className={`flex items-center gap-3 py-2.5 ${row.isMe ? "-mx-2 rounded-lg bg-monad/20 px-2 font-semibold" : ""}`}>
                  <span className={`w-8 text-center font-mono ${row.rank <= 3 ? "text-amber-300" : "text-slate-500"}`}>#{row.rank}</span>
                  <span className="flex-1 truncate">{row.nickname}{row.isMe && " (you)"}</span>
                  {BigInt(row.rewardWei) > 0n && <span className="text-sm text-emerald-300">{formatMon(row.rewardWei, 3)}</span>}
                  <span className="w-12 text-right font-mono">{row.score}/{perfect}</span>
                </li>
              ))}
            </ol>
          )}
          {game.winnersCount === 0 && <p className="mt-3 text-sm text-slate-400">Nobody got a perfect score — the pool returns to the organizer.</p>}
        </div>
      )}

      {data.finalizeError && <p className="text-xs text-amber-300">Still publishing results (will retry): {data.finalizeError}</p>}
    </div>
  );
}
