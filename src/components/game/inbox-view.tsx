import { useState } from "react";
import { useGame } from "@/game/store";

export function InboxView() {
  const { state, readMail, setView } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state) return null;
  const mail = state.mail.slice(0, 12);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className="min-h-11 text-sm font-semibold text-accent" onClick={() => setView("hub")}>
          ← Gym
        </button>
      </div>
      <h1 className="font-display text-3xl">Inbox</h1>
      <p className="text-sm text-muted">Only the notes that matter. Tap one to read it.</p>
      {mail.length === 0 ? (
        <p className="rounded-xl border border-border bg-elevated px-4 py-6 text-sm text-muted">Quiet week. Mail shows up after a big game, not every tip.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mail.map((m) => {
            const open = openId === m.id;
            const preview = m.body.replace(/\s+/g, " ").trim();
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(open ? null : m.id);
                    if (!m.read) readMail(m.id);
                  }}
                  className={`w-full rounded-xl border p-3 text-left ${m.read ? "border-border bg-surface" : "border-accent/40 bg-elevated"}`}
                >
                  <p className="text-xs tracking-widest text-muted uppercase">{m.from} · wk {m.week}</p>
                  <p className="mt-1 font-semibold">{m.subject}</p>
                  {open ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{m.body}</p>
                  ) : (
                    <p className="mt-1 truncate text-sm text-muted">{preview}</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}