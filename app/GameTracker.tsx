"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Game, NOTES_MAX, OPTIONS, OPTION_COLORS, Option } from "@/lib/options";

type Filter = Option | "Open" | null;
type SaveState = "idle" | "saving" | "saved" | "error";

const POLL_MS = 15000;

function todayLocal() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function formatDate(d: string) {
  const date = new Date(d + "T12:00:00");
  return {
    dow: date.toLocaleDateString("en-US", { weekday: "short" }),
    mon: date.toLocaleDateString("en-US", { month: "short" }),
    day: date.getDate(),
    month: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

function formatTime(tipoff: string | null) {
  if (!tipoff) return "Time TBD";
  return (
    new Date(tipoff).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    }) + " CT"
  );
}

function matches(g: Game, f: Filter) {
  if (!f) return true;
  if (f === "Open") return !g.slot1 || !g.slot2;
  return g.slot1 === f || g.slot2 === f;
}

export default function GameTracker() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(null);
  const [showPast, setShowPast] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Notes being typed locally; polling won't overwrite these.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const pending = useRef(0);

  const load = useCallback(async () => {
    if (pending.current > 0) return; // don't clobber in-flight edits
    try {
      const res = await fetch("/api/games", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setGames(data.games);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const save = useCallback(async (id: number, field: "slot1" | "slot2" | "notes", value: string | null) => {
    setGames((gs) => gs && gs.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
    pending.current++;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    } finally {
      pending.current--;
    }
  }, []);

  const today = todayLocal();
  const counts = useMemo(() => {
    const c: Record<string, number> = { Open: 0 };
    OPTIONS.forEach((o) => (c[o] = 0));
    (games ?? []).forEach((g) => {
      if (!showPast && g.game_date < today) return;
      if (g.slot1) c[g.slot1]++;
      if (g.slot2) c[g.slot2]++;
      if (!g.slot1 || !g.slot2) c.Open++;
    });
    return c;
  }, [games, showPast, today]);

  const visible = (games ?? []).filter((g) => (showPast || g.game_date >= today) && matches(g, filter));
  const byMonth: [string, Game[]][] = [];
  for (const g of visible) {
    const m = formatDate(g.game_date).month;
    const last = byMonth[byMonth.length - 1];
    if (last && last[0] === m) last[1].push(g);
    else byMonth.push([m, [g]]);
  }
  const nextGameId = (games ?? []).find((g) => g.game_date >= today)?.id;

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <div className="brand">
            <span className="ball" aria-hidden />
            <div>
              <h1>Grizzlies Game Tracker</h1>
              <p>FedExForum home games · 2026–27</p>
            </div>
          </div>
          <span className={`save save-${saveState}`}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Save failed" : "Live"}
          </span>
        </div>
      </header>

      <nav className="filters" aria-label="Filter games">
        <button className={`chip chip-all ${filter === null ? "active" : ""}`} onClick={() => setFilter(null)}>
          All
        </button>
        {OPTIONS.map((o) => (
          <button
            key={o}
            className={`chip ${filter === o ? "active" : ""}`}
            style={{ "--tag-bg": OPTION_COLORS[o].bg, "--tag-fg": OPTION_COLORS[o].fg } as React.CSSProperties}
            onClick={() => setFilter(filter === o ? null : o)}
          >
            <span className="dot" />
            {o} <b>{counts[o]}</b>
          </button>
        ))}
        <button className={`chip chip-open ${filter === "Open" ? "active" : ""}`} onClick={() => setFilter(filter === "Open" ? null : "Open")}>
          Open seat <b>{counts.Open}</b>
        </button>
        <label className="past-toggle">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Show past games
        </label>
      </nav>

      <main className="list">
        {error && <div className="banner error">⚠️ {error}</div>}
        {!games && !error && <div className="banner">Loading schedule…</div>}
        {games && visible.length === 0 && <div className="banner">No games match this filter.</div>}

        {byMonth.map(([month, list]) => (
          <section key={month}>
            <h2 className="month">{month}</h2>
            {list.map((g) => {
              const d = formatDate(g.game_date);
              const past = g.game_date < today;
              const notes = drafts[g.id] ?? g.notes;
              return (
                <article key={g.id} className={`card ${past ? "past" : ""} ${g.id === nextGameId ? "next" : ""}`}>
                  <div className="date">
                    <span className="dow">{d.dow}</span>
                    <span className="day">{d.day}</span>
                    <span className="mon">{d.mon}</span>
                  </div>
                  <div className="body">
                    <div className="matchup">
                      <span className="vs">vs</span>
                      <span className="opp">{g.opponent}</span>
                      {g.id === nextGameId && <span className="next-badge">Next up</span>}
                    </div>
                    <div className="time">{formatTime(g.tipoff)}</div>
                    <div className="controls">
                      {(["slot1", "slot2"] as const).map((slot, i) => {
                        const v = g[slot];
                        const c = v ? OPTION_COLORS[v] : null;
                        return (
                          <label key={slot} className={`tag-select ${v ? "set" : ""}`} style={c ? ({ "--tag-bg": c.bg, "--tag-fg": c.fg } as React.CSSProperties) : undefined}>
                            <span className="sr-only">Ticket {i + 1}</span>
                            <select value={v ?? ""} onChange={(e) => save(g.id, slot, e.target.value || null)}>
                              <option value="">Ticket {i + 1} —</option>
                              {OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                      <input
                        className="notes"
                        placeholder="Add a note…"
                        maxLength={NOTES_MAX}
                        value={notes}
                        onChange={(e) => setDrafts((ds) => ({ ...ds, [g.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        onBlur={() => {
                          if (drafts[g.id] === undefined) return;
                          const value = drafts[g.id];
                          setDrafts(({ [g.id]: _, ...rest }) => rest);
                          if (value !== g.notes) save(g.id, "notes", value);
                        }}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </main>
      <footer className="foot">Grit &amp; Grind · changes save instantly for everyone</footer>
    </div>
  );
}
