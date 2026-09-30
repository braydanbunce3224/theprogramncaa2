import type { GameState, Mail } from "./types";
import { TEAM_BY_ID } from "./teams";
import { hashString, mulberry32, pick, type Rng } from "./rng";
import type { GameCtx } from "./presser";
import { adFirst, adFrom, boosterFrom, coachFirst, fanFrom } from "./voices";

function mail(partial: Omit<Mail, "read">): Mail {
  return { ...partial, read: false };
}

function starFirst(state: GameState) {
  const p = state.players.filter((x) => x.teamId === state.playerTeamId).sort((a, b) => b.ovr - a.ovr)[0];
  return p?.first ?? "the guys";
}

export function afterGameMail(state: GameState, ctx: GameCtx): Mail[] {
  if (!worthALetter(ctx)) return state.mail;
  const rng = mulberry32(state.seed ^ hashString(ctx.slotId) ^ 0xbad);
  const note =
    ctx.kind === "ncaa" || ctx.margin >= 18 || Math.abs(ctx.streak) >= 4
      ? adNote(state, ctx, rng)
      : ctx.home
        ? fanNote(state, ctx, rng)
        : boosterNote(state, ctx, rng);
  return [note, ...state.mail].slice(0, 16);
}

function worthALetter(ctx: GameCtx) {
  if (ctx.kind === "ncaa" || ctx.kind === "nit" || ctx.kind === "crown" || ctx.kind === "conf-tourney") return true;
  if (ctx.margin >= 18) return true;
  if (Math.abs(ctx.streak) >= 4) return true;
  if (ctx.won && ctx.oppPrestige - ctx.youPrestige >= 14) return true;
  if (!ctx.won && ctx.youPrestige - ctx.oppPrestige >= 14) return true;
  return false;
}

export function weeklyStakeholderMail(state: GameState, week: number): Mail[] {
  if (week < 4 || week % 4 !== 0) return state.mail;
  if (state.mail.some((m) => m.week === week)) return state.mail;
  const rng = mulberry32(state.seed ^ (week * 4243));
  const t = state.teams[state.playerTeamId]!;
  const pct = t.wins + t.losses ? t.wins / (t.wins + t.losses) : 0.5;
  const who = pick(rng, ["ad", "fan", "booster"] as const);
  const extra =
    who === "ad" ? adWeekly(state, pct, week, rng) : who === "fan" ? fanWeekly(state, pct, week, rng) : boosterWeekly(state, pct, week, rng);
  return [extra, ...state.mail].slice(0, 16);
}

function adNote(state: GameState, ctx: GameCtx, rng: Rng): Mail {
  const first = coachFirst(state);
  const helen = adFirst(state);
  const kid = starFirst(state);
  if (ctx.won && ctx.margin >= 12) {
    return mail({
      id: `adg-${ctx.slotId}`,
      from: adFrom(state),
      subject: pick(rng, [`beat ${ctx.oppName}`, "good win", `${ctx.youScore}-${ctx.oppScore}`]),
      body: pick(rng, [
        `${first},\n\n${ctx.youScore}-${ctx.oppScore} against ${ctx.oppName}. ${kid} played well. That's a game we can raise money off of. Let's get another one.\n\n${helen}`,
        `${first} — students stayed after. ${ctx.record}. Nice win.\n\n${helen}`,
        `That was a good night. ${ctx.youScore}-${ctx.oppScore}. Come by the office tomorrow if you want to talk about the rotation.\n\n${helen}`,
      ]),
      week: ctx.week,
      tone: "good",
    });
  }
  if (!ctx.won && ctx.margin >= 12) {
    return mail({
      id: `adg-${ctx.slotId}`,
      from: adFrom(state),
      subject: pick(rng, [`loss to ${ctx.oppName}`, "we need to talk", `${ctx.record}`]),
      body: pick(rng, [
        `${first},\n\n${ctx.youScore}-${ctx.oppScore} to ${ctx.oppName}. I'm going to get asked about it tomorrow. I need a real answer, not "we'll watch film."\n\n${helen}`,
        `${first} — that was a ${ctx.margin}-point loss. ${ctx.record}. Come by in the morning.\n\n${helen}`,
        `I'm not firing anyone tonight. I do need to know what you're changing before the next game.\n\n${helen}`,
      ]),
      week: ctx.week,
      tone: "bad",
    });
  }
  if (ctx.won) {
    return mail({
      id: `adg-${ctx.slotId}`,
      from: adFrom(state),
      subject: pick(rng, ["got the win", `${ctx.record}`, "next one"]),
      body: pick(rng, [
        `${first},\n\nWin is a win. ${ctx.record}. Get some sleep.\n\n${helen}`,
        `${ctx.youScore}-${ctx.oppScore}. I'll take it. See you at practice.\n\n${helen}`,
        `Good. On to the next one.\n\n${helen}`,
      ]),
      week: ctx.week,
      tone: "good",
    });
  }
  return mail({
    id: `adg-${ctx.slotId}`,
    from: adFrom(state),
    subject: pick(rng, [`${ctx.oppName}`, "tough one", ctx.record]),
    body: pick(rng, [
      `${first},\n\n${ctx.record} after ${ctx.oppName}. Not the result we wanted. Get the next one.\n\n${helen}`,
      `I watched it. I'm not going to pile on. Text me if you need me to handle anyone.\n\n${helen}`,
      `${ctx.youScore}-${ctx.oppScore}. We're fine if the next one looks better.\n\n${helen}`,
    ]),
    week: ctx.week,
    tone: "even",
  });
}

function fanNote(state: GameState, ctx: GameCtx, rng: Rng): Mail {
  const from = fanFrom(rng);
  if (ctx.won) {
    return mail({
      id: `fang-${ctx.slotId}`,
      from,
      subject: pick(rng, ["good win", "that was fun", `${ctx.youScore}-${ctx.oppScore}`]),
      body: pick(rng, [
        `Took my nephew. He didn't sit down after we beat ${ctx.oppName}. Thanks for that.`,
        `${ctx.youScore}-${ctx.oppScore}. Place was loud. See you next home game.`,
        `They looked like they wanted to be there. That's all I wanted. Thanks coach.`,
      ]),
      week: ctx.week,
      tone: "good",
    });
  }
  return mail({
    id: `fang-${ctx.slotId}`,
    from,
    subject: pick(rng, ["tough loss", "we were there", `${ctx.oppName}`]),
    body: pick(rng, [
      `I've seen worse. ${ctx.oppName} just wanted it more tonight. Please don't let that become a habit.`,
      `Booing isn't personal. It means we showed up and the team didn't. Win one so I can stop explaining it at work.`,
      `Brought four people. Two of them asked if it's always like this. I didn't have an answer.`,
    ]),
    week: ctx.week,
    tone: "bad",
  });
}

function boosterNote(state: GameState, ctx: GameCtx, rng: Rng): Mail {
  const nil = ctx.nil;
  const from = boosterFrom(rng, nil);
  if (ctx.won) {
    return mail({
      id: `bstr-${ctx.slotId}`,
      from,
      subject: pick(rng, ["good night for us", "people are calling", `${ctx.oppName}`]),
      body: nil
        ? pick(rng, [
            `Coach — after ${ctx.oppName}, people are calling. I'll keep the checks coming if the roster stays happy. Text me if you need a name.`,
            `I can raise money off that win. If you're looking in the portal, don't go cheap.`,
            `A couple of people sat with me after the game. They're in. Just keep playing like that.`,
          ])
        : pick(rng, [
            `That's a night that helps the golf outing. Tell the guys I said thanks.`,
            `I've been writing checks here a long time. Nights like ${ctx.oppName} are why. See you at the next one.`,
            `Tip-off club is happy. So am I. Keep winning.`,
          ]),
      week: ctx.week,
      tone: "good",
    });
  }
  return mail({
    id: `bstr-${ctx.slotId}`,
    from,
    subject: pick(rng, ["harder to raise", "still here", `${ctx.oppName}`]),
    body: nil
      ? pick(rng, [
          `It's hard to ask for money after a loss to ${ctx.oppName}. I'm not going anywhere. I just need something to say besides "wait until March."`,
          `I'm not asking for a miracle. I need a team that looks like it cares, and I'll handle the checks.`,
          `I had to calm two people down after the game. Help me out next week.`,
        ])
      : pick(rng, [
          `The golf outing was quiet. That group looked flat. I still support you. Fix it.`,
          `We'll be at the next one. It would help if they played like they wanted to be there.`,
          `I'm not done with this team. I am tired of explaining the losses at lunch.`,
        ]),
    week: ctx.week,
    tone: "bad",
  });
}

function adWeekly(state: GameState, pct: number, week: number, rng: Rng): Mail {
  const t = state.teams[state.playerTeamId]!;
  const first = coachFirst(state);
  const helen = adFirst(state);
  const kid = starFirst(state);
  const tone = pct >= 0.6 ? "good" : pct <= 0.38 ? "bad" : "even";
  return mail({
    id: `adw-${week}`,
    from: adFrom(state),
    subject: tone === "good" ? pick(rng, ["good week", `${t.wins}-${t.losses}`, "keep going"]) : tone === "bad" ? pick(rng, ["we need to talk", `${t.wins}-${t.losses}`, "need a win"]) : pick(rng, ["checking in", `${t.wins}-${t.losses}`, "hey"]),
    body:
      tone === "good"
        ? pick(rng, [
            `${first},\n\n${t.wins}-${t.losses}. Donors are calling again. ${kid} is the name they bring up. Keep the locker room in a good place.\n\n${helen}`,
            `${first} — people who used to dodge me are saying hello. That's because of the record. Don't lose that.\n\n${helen}`,
          ])
        : tone === "bad"
          ? pick(rng, [
              `${first},\n\n${t.wins}-${t.losses} is not what we hired you to do. I'm in meetings I don't want to be in. Win the next one.\n\n${helen}`,
              `${first} — this is still your job. Call me if you need to talk before you talk to the team.\n\n${helen}`,
            ])
          : pick(rng, [
              `${first},\n\n${t.wins}-${t.losses}. We're stuck in the middle. Keep the locker room together and win a couple.\n\n${helen}`,
              `No panic. ${t.wins}-${t.losses}. I'm here if you need me to handle someone.\n\n${helen}`,
            ]),
    week,
    tone,
  });
}

function fanWeekly(state: GameState, pct: number, week: number, rng: Rng): Mail {
  const from = fanFrom(rng);
  const tone = pct >= 0.6 ? "good" : pct <= 0.38 ? "bad" : "even";
  return mail({
    id: `fanw-${week}`,
    from,
    subject: tone === "good" ? pick(rng, ["this team is fun", "see you Saturday", "good week"]) : tone === "bad" ? pick(rng, ["show up", "empty seats", "come on"]) : pick(rng, ["still here", "Saturday", "hey coach"]),
    body:
      tone === "good"
        ? pick(rng, [
            `This team is fun. I already bought a new shirt. Don't mess it up.`,
            `The student line was around the bookstore. Keep playing like this.`,
          ])
        : tone === "bad"
          ? pick(rng, [
              `We're not asking for perfect. We're asking them to look like they care.`,
              `People started leaving in the second half. We'll still be there if they start playing.`,
            ])
          : pick(rng, [
              `We'll be there Saturday. Just play hard.`,
              `Still coming to the games. A win would help.`,
            ]),
    week,
    tone,
  });
}

function boosterWeekly(state: GameState, pct: number, week: number, rng: Rng): Mail {
  const nil = state.nilCap > 0;
  const from = boosterFrom(rng, nil);
  const tone = pct >= 0.6 ? "good" : pct <= 0.38 ? "bad" : "even";
  return mail({
    id: `bstrw-${week}`,
    from,
    subject: tone === "good" ? pick(rng, ["easy week", "funds are moving", "proud"]) : tone === "bad" ? pick(rng, ["harder ask", "need a win", "help me out"]) : pick(rng, ["checking in", "still writing checks", "from the club"]),
    body:
      tone === "good"
        ? nil
          ? pick(rng, [
              `Good week for the collective because it was a good week for the team. I'll keep calling people if the roster stays happy.`,
              `It's easier to raise money when the team looks like a real program. It does right now. Thanks.`,
            ])
          : pick(rng, [
              `Tip-off club is in. Dinner is on us after the next home game.`,
              `Wins make the annual drive easy. I actually liked asking this week.`,
            ])
        : tone === "bad"
          ? nil
            ? pick(rng, [
                `People don't write checks for a losing team. I'm still in. I'm tired of selling "wait until March."`,
                `The meeting was quiet. A win next week would help.`,
              ])
            : pick(rng, [
                `Boosters are getting restless. A win would help my next meeting. I'm still with you.`,
                `I've been patient. A win would make the next ask a lot easier.`,
              ])
          : pick(rng, [
              `We'll keep doing our part. You handle the games.`,
              `Still showing up. Still writing checks. Win a few.`,
            ]),
    week,
    tone,
  });
}
