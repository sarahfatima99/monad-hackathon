import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { api, getToken, setToken } from "../lib/api";
import { useMe } from "../lib/hooks";
import { friendlyError, shortAddress } from "../lib/format";

type Step = "email" | "code" | "nickname" | "wallet" | "done";

function Steps({ current }: { current: Step }) {
  const steps: [Step, string][] = [["email", "Email"], ["code", "Verify"], ["nickname", "Nickname"], ["wallet", "Wallet"]];
  const idx = current === "done" ? 4 : steps.findIndex(([s]) => s === current);
  return (
    <ol className="mb-6 flex gap-2 text-xs">
      {steps.map(([s, label], i) => (
        <li key={s} className={`flex-1 rounded-full py-1 text-center ${i < idx ? "bg-monad/30 text-monad-light" : i === idx ? "bg-monad text-white" : "bg-white/5 text-slate-500"}`}>
          {i < idx ? "✓ " : ""}{label}
        </li>
      ))}
    </ol>
  );
}

export function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading, refetch } = useMe();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { address, isConnected, connector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const signedIn = !!getToken() && !!me;
  const step: Step = !signedIn ? (codeSent ? "code" : "email") : !me!.nickname ? "nickname" : !me!.walletAddress ? "wallet" : "done";

  useEffect(() => setError(null), [step]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      const res = await api<{ devCode?: string }>("/auth/register", { body: { email } });
      setDevCode(res.devCode ?? null);
      setCodeSent(true);
      setInfo(res.devCode ? null : `We sent a 6-digit code to ${email}. Check your inbox (and spam folder).`);
    });

  const verify = () =>
    run(async () => {
      const { token } = await api<{ token: string }>("/auth/verify", { body: { email, code } });
      setToken(token);
      await queryClient.invalidateQueries();
      await refetch();
    });

  const saveNickname = () =>
    run(async () => {
      await api("/auth/nickname", { body: { nickname } });
      await refetch();
    });

  const linkWallet = () =>
    run(async () => {
      let account = address;
      if (!isConnected) {
        const injected = connectors[0];
        if (!injected) throw new Error("No browser wallet found. Install MetaMask (or another EVM wallet) and reload.");
        const res = await connectAsync({ connector: injected });
        account = res.accounts[0];
      }
      const { message } = await api<{ message: string }>("/auth/wallet/nonce", { body: {} });
      const signature = await signMessageAsync({ message, account, connector });
      await api("/auth/wallet/link", { body: { address: account, signature } });
      await refetch();
    });

  const signOut = () => {
    setToken(null);
    disconnect();
    queryClient.clear();
    setCodeSent(false);
    setCode("");
    navigate("/account");
    location.reload();
  };

  if (getToken() && meLoading) return <p className="text-slate-400">Loading your account…</p>;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold">{step === "done" ? "Your account" : "Create your player account"}</h1>
      <p className="mb-5 text-sm text-slate-400">
        {step === "done" ? "You're all set to join games." : "Email, nickname and a wallet — takes about a minute. Returning player? Enter your email to sign in."}
      </p>
      {step !== "done" && <Steps current={step} />}

      {error && <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
      {info && <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{info}</p>}

      <div className="card space-y-4">
        {step === "email" && (
          <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-3">
            <label className="label" htmlFor="email">Email address</label>
            <input id="email" className="input" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-xs text-slate-500">Your email stays private — it's never written on-chain.</p>
            <button className="btn-primary w-full" disabled={busy || !email}>{busy ? "Sending…" : "Send verification code"}</button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-3">
            <label className="label" htmlFor="code">6-digit code sent to {email}</label>
            {devCode && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Dev mode (no email service configured): your code is <b className="tracking-widest">{devCode}</b>
              </p>
            )}
            <input id="code" className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-slate-400 underline" onClick={() => { setCodeSent(false); setCode(""); setInfo(null); }}>Change email</button>
              <button type="button" className="text-slate-400 underline" disabled={busy} onClick={sendCode}>Resend code</button>
            </div>
          </form>
        )}

        {step === "nickname" && (
          <form onSubmit={(e) => { e.preventDefault(); saveNickname(); }} className="space-y-3">
            <label className="label" htmlFor="nick">Choose a nickname (shown on leaderboards)</label>
            <input id="nick" className="input" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" placeholder="memory_master" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <p className="text-xs text-slate-500">3–20 characters: letters, numbers and underscores.</p>
            <button className="btn-primary w-full" disabled={busy || nickname.length < 3}>{busy ? "Saving…" : "Continue"}</button>
          </form>
        )}

        {step === "wallet" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Connect your wallet and sign a short message to prove it's yours. Signing is free — it's not a transaction.
            </p>
            {isConnected && <p className="text-sm text-slate-400">Connected: <span className="font-mono">{shortAddress(address)}</span></p>}
            <button className="btn-primary w-full" disabled={busy} onClick={linkWallet}>
              {busy ? "Check your wallet…" : isConnected ? "Sign & link this wallet" : "Connect wallet & sign"}
            </button>
            {!connectors.length && <p className="text-xs text-amber-300">No browser wallet detected. Install MetaMask, Rabby or another EVM wallet.</p>}
          </div>
        )}

        {step === "done" && me && (
          <div className="space-y-3 text-sm">
            <Row label="Email" value={<>{me.email} <span className="text-emerald-400">✓ verified</span></>} />
            <Row label="Nickname" value={me.nickname} />
            <Row label="Wallet" value={<span className="font-mono">{me.walletAddress}</span>} />
            {isConnected && address && address.toLowerCase() !== me.walletAddress!.toLowerCase() && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-200">
                Your wallet app is on a different address ({shortAddress(address)}). Switch back to {shortAddress(me.walletAddress)} to play.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn-primary flex-1" onClick={() => navigate("/")}>Browse games</button>
              <button className="btn-secondary" onClick={signOut}>Sign out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}
