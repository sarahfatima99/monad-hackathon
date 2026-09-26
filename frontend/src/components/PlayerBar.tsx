import { Link } from "react-router-dom";
import { useAccount, useBalance } from "wagmi";
import { getToken } from "../lib/api";
import { useAppConfig, useMe } from "../lib/hooks";
import { formatMon, shortAddress } from "../lib/format";

/** Spec §3: nickname, wallet, MON balance (read from chain), rewards won, rewards to claim. */
export function PlayerBar() {
  const cfg = useAppConfig();
  const { data: me } = useMe();
  const { address } = useAccount();
  const wallet = (me?.walletAddress ?? address) as `0x${string}` | undefined;
  const { data: balance } = useBalance({ address: wallet, chainId: cfg.chainId, query: { enabled: !!wallet, refetchInterval: 15_000 } });

  if (!getToken()) {
    return (
      <div className="border-t border-white/5 bg-monad/10 px-4 py-2 text-center text-sm text-slate-300">
        <Link to="/account" className="font-semibold text-monad-light underline">Sign up with your email</Link> to join games and win MON.
      </div>
    );
  }

  const Item = ({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) => (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-slate-500">{label}</span>
      <span className={highlight ? "font-semibold text-emerald-300" : "font-medium text-slate-100"}>{value}</span>
    </div>
  );

  const claimable = me ? BigInt(me.claimableWei) : 0n;

  return (
    <div className="border-t border-white/5 bg-white/[0.02]">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-1 px-4 py-2 text-sm">
        <Item label="Player" value={me?.nickname ?? <Link to="/account" className="text-amber-300 underline">set nickname</Link>} />
        <Item label="Wallet" value={me?.walletAddress ? shortAddress(me.walletAddress) : <Link to="/account" className="text-amber-300 underline">link wallet</Link>} />
        <Item label="Balance" value={balance ? formatMon(balance.value, 3) : "—"} />
        <Item label="Won" value={me ? formatMon(me.totalWonWei, 3) : "—"} />
        {claimable > 0n ? (
          <Link to={`/games/${me!.claimableGames[0].gameId}/results`} className="flex items-baseline gap-1.5">
            <span className="text-slate-500">To claim</span>
            <span className="font-semibold text-emerald-300 underline">{formatMon(claimable, 3)}</span>
          </Link>
        ) : (
          <Item label="To claim" value="0 MON" />
        )}
      </div>
    </div>
  );
}
