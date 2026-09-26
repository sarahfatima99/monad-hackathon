import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, getToken, type GameSummary } from "../lib/api";
import { useNow } from "../lib/hooks";
import { formatCountdown, formatMon, formatStart, STATUS_LABEL, STATUS_STYLE } from "../lib/format";
import { JoinButton } from "../components/JoinButton";

function GameCard({ game, now }: { game: GameSummary; now: number }) {
  const startMs = game.startTime * 1000;
  const status = game.status === "cancelled" ? "cancelled" : now >= game.endTime * 1000 ? "finished" : now >= startMs ? "live" : game.status;
  const open = status === "registration_open" || status === "starting_soon";

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-tight">{game.name}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLE[status]}`}>
          {status === "live" && <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-rose-400" />}
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="text-sm text-slate-400">Starts {formatStart(game.startTime)}</div>

      {open && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Starts in</div>
          <div className="font-mono text-3xl font-bold text-monad-light">{formatCountdown(startMs - now)}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <div className="text-xs text-slate-500">Prize pool</div>
          <div className="font-semibold">{formatMon(game.poolWei, 2)}</div>
        </div>
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <div className="text-xs text-slate-500">Registered players</div>
          <div className="font-semibold">{game.participantCount ?? "—"}</div>
        </div>
      </div>

      <div className="mt-auto pt-1">
        {game.joined && status !== "finished" && status !== "cancelled" ? (
          <Link className="btn-primary w-full" to={`/games/${game.id}`}>{status === "live" ? "Play now" : "Enter lobby"}</Link>
        ) : open ? (
          <JoinButton game={game} />
        ) : status === "live" ? (
          <button className="btn-secondary w-full" disabled>Registration closed</button>
        ) : status === "finished" ? (
          <Link className="btn-secondary w-full" to={`/games/${game.id}/results`}>View results</Link>
        ) : (
          <button className="btn-secondary w-full" disabled>Cancelled</button>
        )}
      </div>
    </div>
  );
}

export function GamesPage() {
  const now = useNow(1000);
  const { data, isLoading, error } = useQuery({
    queryKey: ["games", !!getToken()],
    queryFn: () => api<{ games: GameSummary[] }>("/games"),
    refetchInterval: 10_000
  });

  const games = data?.games ?? [];
  const upcoming = games.filter((g) => g.status !== "finished" && g.status !== "cancelled" && now < g.endTime * 1000);
  const past = games.filter((g) => !upcoming.includes(g) && g.status !== "cancelled").sort((a, b) => b.startTime - a.startTime);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-monad/30 to-transparent p-6 ring-1 ring-monad/30">
        <h1 className="text-2xl font-bold sm:text-3xl">How good is your memory?</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Everyone plays at the same time. You'll see each picture for <b>5 seconds</b>, then answer a question about it
          in <b>5 seconds</b> — up to 5 rounds. Score a perfect 5/5 to split the MON prize pool.
        </p>
        <details className="mt-3 text-sm text-slate-400">
          <summary className="cursor-pointer text-slate-300">Game rules</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Registration closes at the scheduled start — late players can't enter.</li>
            <li>Joining is an on-chain transaction, so it costs a small network fee even when entry is free.</li>
            <li>The funded prize pool is split equally among every player who answers all questions correctly.</li>
            <li>If nobody gets a perfect score, the pool goes back to the organizer.</li>
            <li>Everyone gets the same pictures and questions; answer order is shuffled per player.</li>
          </ul>
        </details>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Upcoming games</h2>
        {isLoading && <p className="text-slate-400">Loading games…</p>}
        {error && <p className="text-rose-300">{(error as Error).message}</p>}
        {!isLoading && !upcoming.length && (
          <div className="card text-center text-slate-400">No games scheduled right now — check back soon.</div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((g) => <GameCard key={g.id} game={g} now={now} />)}
        </div>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-300">Recent results</h2>
          <div className="divide-y divide-white/5 rounded-2xl border border-white/10">
            {past.slice(0, 8).map((g) => (
              <Link key={g.id} to={`/games/${g.id}/results`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/5">
                <span className="font-medium">{g.name}</span>
                <span className="text-slate-400">
                  {formatStart(g.startTime)} · {formatMon(g.poolWei, 2)}
                  {g.finalized && g.winnersCount !== null && ` · ${g.winnersCount} winner${g.winnersCount === 1 ? "" : "s"}`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
