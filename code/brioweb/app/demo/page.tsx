import type { Metadata } from "next";
import { TodayWorkspace } from "@/components/today-workspace";

export const metadata: Metadata = { title: "Synthetic demo" };

export default function DemoPage() {
  return <TodayWorkspace guest anchorDate="2026-09-13" />;
}
