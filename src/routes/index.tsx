import { createFileRoute } from "@tanstack/react-router";
import { VisualizerApp } from "@/components/visualizer/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <VisualizerApp />;
}
