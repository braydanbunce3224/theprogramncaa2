import { createFileRoute } from "@tanstack/react-router";
import { GameApp } from "@/game/App";

export const Route = createFileRoute("/$")({
  component: GameApp,
});
