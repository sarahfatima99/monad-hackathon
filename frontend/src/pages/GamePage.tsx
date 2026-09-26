import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, getToken, type GameSummary } from "../lib/api";
import { useNow } from "../lib/hooks";
import { getPhase, phaseKey, type Phase } from "../lib/schedule";
import { serverNow } from "../lib/clock";
import { formatCountdown, formatMon, formatStart } from "../lib/format";
import { JoinButton } from "../components/JoinButton";

interface PlayState {
  registered: boolean;
  phase: Phase;
  photo?: string;
  question?: string;
  options?: { id: number; text: string }[];
  myAnswer?: number | null;
}

/** Shrinking bar + seconds left for the current photo/question window. */
function TimerBar({ startsAt, endsAt, now, color }: { startsAt: number; endsAt: number; now: number; color: string }) {
  const total = endsAt - startsAt;
  const left = Math.max(0, endsAt - now);
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color} transition-[width] duration-100 ease-linear`} style={{ width: `${(left / total) * 100}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-lg font-bold tabular-nums">{Math.ceil(left / 1000)}s</span>
    </div>
  );
}

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const now = useNow(100);

  const { data, error } = useQuery({
    queryKey: ["game", gameId, !!getToken()],
    queryFn: () => api<{ game: GameSummary }>(`/games/${gameId}`),
    refetchInterval: (q) => ((q.state.data?.game.startTime ?? 0) * 1000 > serverNow() ? 5_000 : false)
  });
  const game = data?.game;

  const phase = game ? getPhase(game, now) : null;
  const key = phase ? phaseKey(phase) : "";

  const [play, setPlay] = useState<PlayState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerMsg, setAnswerMsg] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  // Fetch the round's content the moment the (server-synced) clock enters a
  // new photo/question window. Content is only released by the server during
  // its own window, so if our clock is a hair early we retry briefly.
  useEffect(() => {
    if (!game || !phase || !getToken()) return;
    if (phase.phase !== "photo" && phase.phase !== "question") return;
    const seq = ++fetchSeq.current;
    setSelected(null);
    setAnswerMsg(null);
    let tries = 0;
    const load = async () => {
      try {
        const s = await api<PlayState>(`/games/${game.id}/play`);
        if (seq !== fetchSeq.current) return;
        if (phaseKey(s.phase) !== key && tries++ < 8) return void setTimeout(load, 150);
        setPlay(s);
        if (s.myAnswer !== undefined && s.myAnswer !== null) setSelected(s.myAnswer);
      } catch {
        if (seq === fetchSeq.current && tries++ < 8) setTimeout(load, 300);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, game?.id]);

  // When the last question closes, go to the results.
  useEffect(() => {
    if (phase?.phase === "finished" && game?.joined) {
      const t = setTimeout(() => navigate(`/games/${game.id}/results`), 1200);
      return () => clearTimeout(t);
    }
  }, [phase?.phase, game?.joined, game?.id, navigate]);

  async function answer(optionId: number) {
    if (!game || phase?.phase !== "question") return;
    setSelected(optionId);
    setAnswerMsg(null);
    try {
      await api(`/games/${game.id}/answer`, { body: { roundIndex: phase.roundIndex, optionIndex: optionId } });
      setAnswerMsg("Answer locked in");
    } catch (e) {
      setAnswerMsg((e as Error).message);
    }
  }

  if (error) return <p className="text-rose-300">{(error as Error).message}</p>;
  if (!game || !phase) return <p className="text-slate-400">Loading game…</p>;

  const roundLabel = (i: number) => `Round ${i + 1} of ${game.roundsCount}`;

  // ---------- Lobby (before start) ----------
  if (phase.phase === "waiting") {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="card space-y-5 text-center">
          <div>
            <p className="text-sm text-slate-400">{game.joined ? "You're in! Waiting for the start…" : "Lobby"}</p>
            <h1 className="mt-1 text-2xl font-bold">{game.name}</h1>
            <p className="text-sm text-slate-400">Starts {formatStart(game.startTime)}</p>
          </div>
          <div className="font-mono text-5xl font-bold text-monad-light sm:text-6xl">{formatCountdown(phase.endsAt - now)}</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-slate-500">Prize pool</div>
              <div className="text-lg font-semibold">{formatMon(game.poolWei, 2)}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-slate-500">Registered players</div>
              <div className="text-lg font-semibold">{game.participantCount ?? "—"}</div>
            </div>
          </div>
          {!game.joined && game.status !== "cancelled" && <JoinButton game={game} className="mx-auto max-w-xs" />}
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">How it works</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>A picture appears for <b>{game.photoSeconds} seconds</b> — remember as much as you can.</li>
            <li>It disappears and a question about it appears for <b>{game.questionSeconds} seconds</b>. Tap your answer.</li>
            <li>This repeats for {game.roundsCount} rounds. Each correct answer is 1 point.</li>
            <li>Get {game.roundsCount}/{game.roundsCount} to share the prize pool.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">Keep this tab open. The game starts automatically for everyone — refreshing won't restart it.</p>
        </div>
      </div>
    );
  }

  // ---------- Finished ----------
  if (phase.phase === "finished") {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <h1 className="text-xl font-bold">Game over</h1>
        <p className="text-slate-400">{game.joined ? "Calculating results…" : "This game has finished."}</p>
        <Link className="btn-primary" to={`/games/${game.id}/results`}>See results</Link>
      </div>
    );
  }

  // ---------- Live, but this player isn't in it ----------
  if (!game.joined && play && !play.registered) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <h1 className="text-xl font-bold">{game.name} is live</h1>
        <p className="text-slate-400">Registration closed at the start, so you can't enter this one. Join an upcoming game instead.</p>
        <Link className="btn-primary" to="/">Upcoming games</Link>
      </div>
    );
  }
  if (!getToken()) {
    return (
      <div className="card mx-auto max-w-md space-y-3 text-center">
        <h1 className="text-xl font-bold">{game.name} is live</h1>
        <Link className="btn-primary" to="/account">Sign in to play</Link>
      </div>
    );
  }

  const ready = play && phaseKey(play.phase) === key;

  // ---------- Photo ----------
  if (phase.phase === "photo") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-monad-light">{roundLabel(phase.roundIndex)}</span>
          <span className="text-slate-400">Memorize this picture</span>
        </div>
        <TimerBar startsAt={phase.startsAt} endsAt={phase.endsAt} now={now} color="bg-monad" />
        <div className="aspect-[3/2] overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
          {ready && play.photo ? (
            <img src={play.photo} alt="Memorize this picture" className="h-full w-full object-contain" draggable={false} />
          ) : (
            <div className="grid h-full place-items-center text-slate-500">Loading picture…</div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Question ----------
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-monad-light">{roundLabel(phase.roundIndex)}</span>
        <span className="text-slate-400">Answer before time runs out</span>
      </div>
      <TimerBar startsAt={phase.startsAt} endsAt={phase.endsAt} now={now} color="bg-amber-400" />
      <div className="card space-y-4">
        <h2 className="text-center text-xl font-bold sm:text-2xl">{ready ? play.question : "…"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ready &&
            play.options?.map((o) => (
              <button
                key={o.id}
                onClick={() => answer(o.id)}
                className={`rounded-xl border px-4 py-4 text-lg font-semibold transition ${
                  selected === o.id ? "border-monad bg-monad/25 text-white ring-2 ring-monad" : "border-white/15 bg-white/5 hover:bg-white/10"
                }`}
              >
                {o.text}
              </button>
            ))}
        </div>
        <p className="h-5 text-center text-sm text-slate-400">{answerMsg ?? (selected === null ? "Tap an answer — you can change it until the timer ends." : "")}</p>
      </div>
    </div>
  );
}
