import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAppConfig } from "../lib/hooks";
import { formatStart, shortAddress, STATUS_LABEL } from "../lib/format";
import type { GameStatus } from "../lib/api";

const KEY_STORAGE = "mmc_admin_key";

interface AdminStatus {
  chainId: number;
  contractAddress: string | null;
  operatorAddress: string | null;
  operatorBalanceMon: string | null;
  emailConfigured: boolean;
  sceneCount: number;
  photoSeconds: number;
  questionSeconds: number;
}

interface AdminGame {
  id: string;
  onchainGameId: number;
  name: string;
  startTime: number;
  roundsCount: number;
  status: GameStatus;
  finalizeState: string;
  winnersCount: number | null;
  poolMon: string | null;
  participantCount: number | null;
  onchainStatus: string | null;
  withdrawableMon: string | null;
}

function defaultStart() {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminPage() {
  const cfg = useAppConfig();
  const queryClient = useQueryClient();
  const [key, setKey] = useState(() => {
    try { return sessionStorage.getItem(KEY_STORAGE) ?? ""; } catch { return ""; }
  });
  const [keyInput, setKeyInput] = useState("");

  const status = useQuery({
    queryKey: ["admin-status", key],
    queryFn: () => api<AdminStatus>("/admin/status", { adminKey: key }),
    enabled: !!key,
    retry: false
  });
  const games = useQuery({
    queryKey: ["admin-games", key],
    queryFn: () => api<{ games: AdminGame[] }>("/admin/games", { adminKey: key }),
    enabled: !!key && status.isSuccess,
    refetchInterval: 15_000
  });

  useEffect(() => {
    if (status.error) {
      setKey("");
      try { sessionStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ }
    }
  }, [status.error]);

  const [form, setForm] = useState({ name: "Memory Challenge #1", start: defaultStart(), poolMon: "1", roundsCount: 5 });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ gameId: string; rounds: any[] } | null>(null);

  async function act(label: string, fn: () => Promise<string>) {
    setBusy(label);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      await queryClient.invalidateQueries();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!key) {
    return (
      <div className="card mx-auto max-w-sm space-y-3">
        <h1 className="text-xl font-bold">Organizer</h1>
        <p className="text-sm text-slate-400">Enter the admin key (the ADMIN_KEY server setting).</p>
        {status.error && <p className="text-sm text-rose-300">{(status.error as Error).message}</p>}
        <form onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem(KEY_STORAGE, keyInput); } catch { /* ignore */ } setKey(keyInput); }} className="space-y-3">
          <input className="input" type="password" autoComplete="current-password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Admin key" />
          <button className="btn-primary w-full" disabled={!keyInput}>Continue</button>
        </form>
      </div>
    );
  }

  const s = status.data;
  const lowBalance = s?.operatorBalanceMon !== null && s?.operatorBalanceMon !== undefined && Number(s.operatorBalanceMon) < Number(form.poolMon) + 0.05;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizer</h1>
        <button className="text-sm text-slate-400 underline" onClick={() => { setKey(""); try { sessionStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ } }}>Lock</button>
      </div>

      {s && (
        <div className="card grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-slate-500">Network:</span> {cfg.chainName} ({s.chainId})</div>
          <div><span className="text-slate-500">Contract:</span> <span className="font-mono">{s.contractAddress ? shortAddress(s.contractAddress) : <b className="text-rose-300">not set</b>}</span></div>
          <div>
            <span className="text-slate-500">Operator wallet:</span>{" "}
            {s.operatorAddress ? <span className="font-mono">{s.operatorAddress}</span> : <b className="text-rose-300">OPERATOR_PRIVATE_KEY not set</b>}
          </div>
          <div><span className="text-slate-500">Operator balance:</span> {s.operatorBalanceMon === null ? "—" : Number(s.operatorBalanceMon).toLocaleString(undefined, { maximumFractionDigits: 4 })} MON</div>
          <div><span className="text-slate-500">Email:</span> {s.emailConfigured ? "Resend ✓" : <b className="text-amber-300">not configured (codes shown on screen)</b>}</div>
          <div><span className="text-slate-500">Timing:</span> {s.photoSeconds}s photo + {s.questionSeconds}s question · {s.sceneCount} scenes in the bank</div>
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Schedule a new game</h2>
        <p className="text-sm text-slate-400">
          The prize pool is paid from the operator wallet above into the contract when you create the game. Photos and questions are picked at random from the scene bank.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            act("create", async () => {
              const startTime = Math.floor(new Date(form.start).getTime() / 1000);
              const r = await api<{ id: string; onchainGameId: number }>("/admin/games", {
                adminKey: key,
                body: { name: form.name, startTime, poolMon: form.poolMon, roundsCount: form.roundsCount }
              });
              return `Created "${form.name}" (on-chain game #${r.onchainGameId}). It's now listed on the Games page.`;
            });
          }}
        >
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input className="input" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Start time (your local time)</label>
            <input className="input" type="datetime-local" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </div>
          <div>
            <label className="label">Prize pool (MON)</label>
            <input className="input" required inputMode="decimal" pattern="\d+(\.\d+)?" value={form.poolMon} onChange={(e) => setForm({ ...form, poolMon: e.target.value })} />
          </div>
          <div>
            <label className="label">Rounds (photos + questions)</label>
            <select className="input" value={form.roundsCount} onChange={(e) => setForm({ ...form, roundsCount: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" disabled={!!busy}>{busy === "create" ? "Funding on-chain…" : "Create & fund game"}</button>
          </div>
          {lowBalance && <p className="text-sm text-amber-300 sm:col-span-2">The operator wallet may not have enough MON for this pool plus gas.</p>}
        </form>
      </div>

      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{msg.text}</p>}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Games</h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-slate-500">
            <tr><th className="py-2">Game</th><th>Start</th><th>Status</th><th>Pool</th><th>Players</th><th>Result</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {games.data?.games.map((g) => (
              <tr key={g.id}>
                <td className="py-2"><Link className="underline" to={`/games/${g.id}`}>{g.name}</Link> <span className="text-slate-500">#{g.onchainGameId}</span></td>
                <td>{formatStart(g.startTime)}</td>
                <td>{STATUS_LABEL[g.status]}</td>
                <td>{g.poolMon ?? "—"}</td>
                <td>{g.participantCount ?? "—"}</td>
                <td>{g.finalizeState === "done" ? `${g.winnersCount} winner(s)` : g.status === "finished" ? "pending" : ""}</td>
                <td className="space-x-2 whitespace-nowrap text-right">
                  <button className="underline" onClick={async () => setPreview({ gameId: g.id, rounds: (await api<{ rounds: any[] }>(`/admin/games/${g.id}/rounds`, { adminKey: key })).rounds })}>Preview</button>
                  {(g.status === "registration_open" || g.status === "starting_soon") && (
                    <button className="text-rose-300 underline" disabled={!!busy} onClick={() => confirm(`Cancel "${g.name}"?`) && act("cancel", async () => { await api(`/admin/games/${g.id}/cancel`, { adminKey: key, body: {} }); return "Game cancelled. Withdraw the pool when you're ready."; })}>Cancel</button>
                  )}
                  {g.status === "finished" && g.finalizeState !== "done" && (
                    <button className="underline" disabled={!!busy} onClick={() => act("finalize", async () => { await api(`/admin/games/${g.id}/finalize`, { adminKey: key, body: {} }); return "Results published."; })}>Publish results</button>
                  )}
                  {g.withdrawableMon && Number(g.withdrawableMon) > 0 && (
                    <button className="text-emerald-300 underline" disabled={!!busy} onClick={() => act("withdraw", async () => { await api(`/admin/games/${g.id}/withdraw`, { adminKey: key, body: {} }); return `Withdrew ${g.withdrawableMon} MON to the operator wallet.`; })}>Withdraw {g.withdrawableMon}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!games.data?.games.length && <p className="py-3 text-slate-400">No games yet.</p>}
      </div>

      {preview && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Preview (answers visible — organizer only)</h2>
            <button className="text-sm underline" onClick={() => setPreview(null)}>Close</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {preview.rounds.map((r) => (
              <div key={r.roundIndex} className="space-y-2">
                <img src={r.photo} alt="" className="w-full rounded-lg" />
                <p className="text-sm font-medium">{r.roundIndex + 1}. {r.question}</p>
                <p className="text-xs text-slate-400">{r.options.map((o: string, i: number) => (i === r.correctIndex ? `✓ ${o}` : o)).join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
