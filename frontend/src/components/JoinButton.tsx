import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect } from "wagmi";
import { api, getToken, type GameSummary } from "../lib/api";
import { useContractTx, useMe } from "../lib/hooks";
import { friendlyError, shortAddress } from "../lib/format";

/**
 * Spec §4 "Join game": checks the account is ready (verified email, nickname,
 * linked wallet, and that same wallet connected), registers the wallet on-chain
 * with joinGame(), then tells the backend and opens the lobby.
 */
export function JoinButton({ game, className = "" }: { game: GameSummary; className?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const send = useContractTx();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsAccount = !getToken() || !me || !me.nickname || !me.walletAddress;

  async function join() {
    setError(null);
    if (needsAccount) return navigate("/account");
    try {
      if (!isConnected) {
        setBusy("Connecting wallet…");
        await connectAsync({ connector: connectors[0] });
      }
      setBusy("Confirm in your wallet…");
      const hash = await send({ functionName: "joinGame", args: [BigInt(game.onchainGameId)], value: BigInt(game.entryFeeWei) });
      setBusy("Registering…");
      await api(`/games/${game.id}/join`, { body: { txHash: hash } });
      await queryClient.invalidateQueries({ queryKey: ["games"] });
      await queryClient.invalidateQueries({ queryKey: ["game", game.id] });
      navigate(`/games/${game.id}`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const wrongWallet = isConnected && me?.walletAddress && address?.toLowerCase() !== me.walletAddress.toLowerCase();

  return (
    <div className={className}>
      <button className="btn-primary w-full" disabled={!!busy || !!wrongWallet} onClick={join}>
        {busy ?? (needsAccount ? "Finish sign-up to join" : BigInt(game.entryFeeWei) > 0n ? "Join game (entry fee)" : "Join game")}
      </button>
      {wrongWallet && (
        <p className="mt-2 text-xs text-amber-300">
          Switch your wallet to your linked address {shortAddress(me!.walletAddress)} to join.
        </p>
      )}
      {!busy && !needsAccount && !wrongWallet && <p className="mt-2 text-xs text-slate-500">Free to enter — you only pay the network fee.</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
