import { useState } from "react";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

type Step = "email" | "code" | "nickname" | "wallet" | "done";

export function AccountPage() {
  const hasToken = !!localStorage.getItem("token");
  const [step, setStep] = useState<Step>(hasToken ? "done" : "email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me, enabled: step === "done" });

  async function handleRegister() {
    setError(null);
    try {
      await api.register(email);
      setStep("code");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleVerify() {
    setError(null);
    try {
      const { token } = await api.verify(email, code);
      localStorage.setItem("token", token);
      setStep("nickname");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleNickname() {
    setError(null);
    try {
      await api.setNickname(nickname);
      setStep("wallet");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleLinkWallet() {
    setError(null);
    try {
      if (!isConnected) {
        connect({ connector: connectors[0] });
        return;
      }
      const { message } = await api.walletNonce();
      const signature = await signMessageAsync({ message });
      await api.linkWallet(address!, signature);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Account</h1>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {step === "email" && (
        <div className="space-y-2">
          <p className="text-slate-400 text-sm">Enter your email to get a verification code.</p>
          <input
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary" onClick={handleRegister}>
            Send code
          </button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-2">
          <p className="text-slate-400 text-sm">Enter the 6-digit code sent to {email}.</p>
          <input
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn-primary" onClick={handleVerify}>
            Verify
          </button>
        </div>
      )}

      {step === "nickname" && (
        <div className="space-y-2">
          <p className="text-slate-400 text-sm">Choose a unique nickname.</p>
          <input
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
            placeholder="playerOne"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button className="btn-primary" onClick={handleNickname}>
            Continue
          </button>
        </div>
      )}

      {step === "wallet" && (
        <div className="space-y-2">
          <p className="text-slate-400 text-sm">
            {isConnected ? "Sign a message to prove you own this wallet." : "Connect a wallet."}
          </p>
          <button className="btn-primary" onClick={handleLinkWallet}>
            {isConnected ? "Sign & link wallet" : "Connect wallet"}
          </button>
        </div>
      )}

      {step === "done" && me && (
        <div className="rounded-lg border border-slate-800 p-4 space-y-1 text-sm">
          <div>
            <span className="text-slate-500">Email:</span> {me.email} {me.emailVerified ? "✅" : "(unverified)"}
          </div>
          <div>
            <span className="text-slate-500">Nickname:</span> {me.nickname ?? "not set"}
          </div>
          <div>
            <span className="text-slate-500">Wallet:</span> {me.walletAddress ?? "not linked"}
          </div>
        </div>
      )}
    </div>
  );
}
