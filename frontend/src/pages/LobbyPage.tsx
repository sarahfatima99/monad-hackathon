import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api } from "../lib/api";

type Phase =
  | { phase: "waiting"; secondsToStart: number }
  | { phase: "photo" | "question"; roundIndex: number; secondsRemaining: number }
  | { phase: "finished" };

export function LobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase | null>(null);
  const [round, setRound] = useState<any>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!gameId) return;
    const socket = io(import.meta.env.VITE_API_URL as string);
    socketRef.current = socket;
    socket.emit("join-game-room", gameId);
    socket.on("phase", (p: Phase) => setPhase(p));
    return () => {
      socket.disconnect();
    };
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !phase) return;
    if (phase.phase === "finished") {
      navigate(`/games/${gameId}/results`);
      return;
    }
    if (phase.phase === "photo" || phase.phase === "question") {
      api
        .round(gameId)
        .then(setRound)
        .catch(() => setRound(null));
      setSelected(null);
    }
  }, [gameId, phase?.phase, (phase as any)?.roundIndex]);

  async function submitAnswer(optionIndex: number) {
    if (!gameId || phase?.phase !== "question") return;
    setSelected(optionIndex);
    await api.answer(gameId, phase.roundIndex, optionIndex).catch(() => {});
  }

  if (!phase) return <p className="text-slate-400">Connecting…</p>;

  if (phase.phase === "waiting") {
    return (
      <div className="card max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Lobby</h1>
        <p className="text-slate-400 text-sm">
          Hang tight — the game starts automatically for everyone at the same time.
        </p>
        <p className="text-emerald-400 text-3xl font-mono">{phase.secondsToStart}s</p>
        <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
          <li>You'll see a photo for 5 seconds, then a question about it for 5 seconds.</li>
          <li>This repeats for up to 5 rounds.</li>
          <li>Refreshing this page will not restart the game — you'll rejoin exactly where it is.</li>
        </ul>
      </div>
    );
  }

  if (phase.phase === "photo") {
    return (
      <div className="max-w-md mx-auto text-center space-y-3">
        <p className="text-slate-400">Round {phase.roundIndex + 1} — memorize this</p>
        {round?.photoUrl && <img src={round.photoUrl} alt="Memorize this" className="rounded-lg w-full" />}
        <p className="text-emerald-400 font-mono text-xl">{phase.secondsRemaining}s</p>
      </div>
    );
  }

  if (phase.phase !== "question") return null;

  // question phase
  return (
    <div className="max-w-md mx-auto space-y-3">
      <p className="text-slate-400">Round {phase.roundIndex + 1}</p>
      <h2 className="text-lg font-semibold">{round?.question}</h2>
      <div className="grid gap-2">
        {round?.options?.map((opt: string, i: number) => (
          <button
            key={i}
            onClick={() => submitAnswer(i)}
            className={`text-left px-4 py-2 rounded-md border ${
              selected === i ? "border-emerald-400 bg-emerald-500/10" : "border-slate-700 hover:bg-slate-800"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <p className="text-emerald-400 font-mono">{phase.secondsRemaining}s</p>
    </div>
  );
}
