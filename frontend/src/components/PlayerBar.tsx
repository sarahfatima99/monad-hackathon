import { useAccount, useBalance } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { api } from "../lib/api";

export function PlayerBar() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, query: { enabled: isConnected, refetchInterval: 15000 } });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: !!localStorage.getItem("token"),
    refetchInterval: 20000
  });

  if (!localStorage.getItem("token")) return null;

  return (
    <div className="bg-slate-900/70 border-b border-slate-800 px-6 py-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-300">
      <span>
        <span className="text-slate-500">Nickname:</span> {me?.nickname ?? "—"}
      </span>
      <span>
        <span className="text-slate-500">Wallet:</span>{" "}
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "not connected"}
      </span>
      <span>
        <span className="text-slate-500">MON balance:</span>{" "}
        {balance ? `${Number(formatEther(balance.value)).toFixed(3)} MON` : "—"}
      </span>
      <span>
        <span className="text-slate-500">Rewards won:</span>{" "}
        {me ? `${Number(formatEther(BigInt(me.totalRewardsWei))).toFixed(3)} MON` : "—"}
      </span>
    </div>
  );
}
