import { useState } from "react";
import { useGame } from "@/game/store";
import { bindTap } from "@/lib/tap";
import { AppFrame } from "@/components/game/app-frame";

const STEPS = [
  { title: "Gym", body: "This is home. Play the next game or sim it. Set your offense and defense, or let the staff call it. You get four timeouts, plus one in overtime. Career mode starts you at a smaller program. Pick a Team lets you take any school." },
  { title: "Schedule", body: "Fill the non-conference. Home, away, or a holiday tournament. The season is 30 games. Rivalry games show the trophy name. Hit Begin Season when you're ready." },
  { title: "Recruiting", body: "Scout, offer, host a visit, then sign. 48 means he's listening. 68 means he's close. An offer uses a scholarship. The national board is the top 100. Prospects is the rest of the class still available." },
  { title: "Roster", body: "You set minutes and usage. Talk to your players, and keep the promises you make. Redshirt someone before he plays. Name a captain." },
  { title: "Program", body: "Hire an offensive coordinator, a defensive coordinator, and a recruiting coordinator. Upgrade facilities. Set the weekly practice plan. Scout the next opponent." },
  { title: "Around the program", body: "Inbox is your AD, boosters, and fans. News covers the games. Podcasts is Locked On your school. Kentucky coaches also get The Catican, and a merch shop. The Burner is the rumor board. Toughest Places ranks home courts. The record book and the bubble board track where you stand." },
  { title: "March", body: "Selection Sunday sets the field of 68. Miss the NCAA Tournament and you can still play the NIT. Win it all and they cut the nets." },
];

export function Tutorial() {
  const { skipTutorial, finishTutorial } = useGame();
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  return (
    <AppFrame
      footer={
        <div className="flex gap-2 px-5 py-3" style={{ paddingBottom: "calc(0.75rem + var(--dock-pad))" }}>
          {i > 0 && (
            <button type="button" className="min-h-12 flex-1 rounded-lg bg-elevated font-semibold" {...bindTap(() => setI(i - 1))}>
              Back
            </button>
          )}
          <button
            type="button"
            className="min-h-12 flex-[2] rounded-lg bg-accent font-semibold text-accent-fg"
            {...bindTap(() => (last ? finishTutorial() : setI(i + 1)))}
          >
            {last ? "Take the job" : "Next"}
          </button>
        </div>
      }
    >
      <div className="px-5 py-8">
        <div className="mx-auto flex w-full max-w-lg flex-col">
        <div className="flex items-center justify-between">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">How to play</p>
          <button type="button" className="min-h-11 text-sm text-muted" {...bindTap(skipTutorial)}>
            Skip tutorial
          </button>
        </div>
        <p className="mt-6 text-xs text-subtle">{i + 1} / {STEPS.length}</p>
        <h1 className="font-display mt-2 text-4xl">{step.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">{step.body}</p>
        </div>
      </div>
    </AppFrame>
  );
}
