import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { api } from "../lib/api";
import { CONTRACT_ADDRESS, memoryGameAbi } from "../lib/wagmi";

export function ResultsPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: board } = useQuery({
    queryKey: ["leaderboard", gameId],
    queryFn: () => api.leaderboard(gameId!),
    enabled: !!gameId,
    refetchInterval: 5000
  });

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });

  const { data: claimInfo } = useQuery({
    queryKey: ["claim-info", gameId],
    queryFn: () => api.claimInfo(gameId!),
    enabled: !!gameId && board?.status === "finished"
  });

  async function handleClaim() {
    if (!gameId || !claimInfo?.eligible || claimInfo.onchainGameId === undefined) return;
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: memoryGameAbi,
        functionName: "claimReward",
        args: [
          BigInt(claimInfo.onchainGameId),
          BigInt(claimInfo.amountWei ?? "0"),
          (claimInfo.proof ?? []) as `0x${string}`[]
        ]
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      alert("Reward claimed!");
    } catch (e: any) {
      alert(e.message ?? "Claim failed");
    }
  }

  const myEntry = board?.leaderboard.find((e) => e.nickname === me?.nickname);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Results</h1>
      <div className="card divide-y divide-slate-800">
        {board?.leaderboard.map((entry) => (
          <div
            key={entry.accountId}
            className={`flex justify-between py-2 text-sm ${
              entry.accountId === myEntry?.accountId ? "text-emerald-400 font-semibold" : "text-slate-300"
            }`}
          >
            <span>
              #{entry.rank} {entry.nickname}
            </span>
            <span>{entry.score}/5</span>
          </div>
        ))}
        {!board?.leaderboard.length && <p className="text-slate-500 text-sm py-2">No results yet.</p>}
      </div>

      {claimInfo?.eligible && (
        <div className="card space-y-2">
          <p className="text-emerald-400">
            You scored 5/5 — reward: {formatEther(BigInt(claimInfo.amountWei ?? "0"))} MON
          </p>
          <button className="btn-primary" disabled={isPending} onClick={handleClaim}>
            {isPending ? "Claiming…" : "Claim"}
          </button>
        </div>
      )}
    </div>
  );
}
