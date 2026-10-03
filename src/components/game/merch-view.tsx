import { useState } from "react";
import { useGame } from "@/game/store";
import { bindTap } from "@/lib/tap";
import { teamOf } from "@/game/teams";

type Item = {
  id: string;
  name: string;
  price: string;
  note: string;
};

const ITEMS: Item[] = [
  { id: "jarred", name: "Team Jarred", price: "$32", note: "Pick a side." },
  { id: "sully", name: "Team Sully", price: "$32", note: "Pick a side." },
  { id: "rewind", name: "Rewind hoodie", price: "$68", note: "Heavy hoodie with a front pocket. Ben keeps one on the back of his chair for when he puts the game on again." },
  { id: "take", name: "Coffee mug", price: "$18", note: "A regular mug that actually holds a full cup. Kaleb's is usually on the table before anyone else sits down." },
  { id: "four", name: "Show poster", price: "$24", note: "Jarred, Ben, Kaleb, and Trill, standing still for once. Big enough to hang, small enough that you don't need a frame." },
  { id: "nose", name: "Bumper sticker", price: "$4", note: "Little NoseBleed sticker. Bumper, laptop, water bottle. It stays on." },
];

export function MerchView() {
  const { state, setView } = useGame();
  const [bag, setBag] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<string[] | null>(null);
  if (!state) return null;
  const open = state.playerTeamId === "kentucky";
  const school = teamOf(state.playerTeamId);

  function add(id: string) {
    setReceipt(null);
    setBag((cur) => (cur.includes(id) ? cur : [...cur, id]));
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="min-h-11 self-start text-sm font-semibold text-accent" {...bindTap(() => setView("hub"))}>
        ← Gym
      </button>
      <div>
        <p className="text-xs tracking-[0.18em] text-muted uppercase">The Catican shop</p>
        <h1 className="font-display mt-1 text-3xl">Merch</h1>
        <p className="mt-1 text-sm text-muted">
          {open
            ? `Tees, a hoodie, and a few things from the show. ${school.name} only.`
            : "The shop is closed. It opens for the Kentucky job."}
        </p>
      </div>
      {open && (
        <>
          <ul className="flex flex-col gap-2">
            {ITEMS.map((item) => {
              const inBag = bag.includes(item.id);
              return (
                <li key={item.id} className="rounded-xl border border-border bg-elevated p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-1 text-sm text-muted">{item.note}</p>
                    </div>
                    <p className="shrink-0 tabular-nums text-sm">{item.price}</p>
                  </div>
                  <button
                    type="button"
                    className="mt-3 min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold"
                    {...bindTap(() => add(item.id))}
                  >
                    {inBag ? "In the bag" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="rounded-xl border border-border bg-elevated p-4">
            <p className="text-xs tracking-[0.18em] text-muted uppercase">Bag</p>
            <p className="mt-1 text-sm">
              {bag.length ? bag.map((id) => ITEMS.find((item) => item.id === id)?.name).filter(Boolean).join(", ") : "Empty."}
            </p>
            <button
              type="button"
              className="mt-3 min-h-11 rounded-lg bg-accent px-3 font-semibold text-accent-fg disabled:opacity-40"
              disabled={bag.length === 0}
              {...bindTap(() => {
                setReceipt(bag);
                setBag([]);
              })}
            >
              Checkout
            </button>
            {receipt && (
              <p className="mt-3 text-sm text-muted">
                Order in. Pick it up at the next show.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
