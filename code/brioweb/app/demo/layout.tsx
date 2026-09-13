import { WorkspaceShell } from "@/components/workspace-shell";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell guest>{children}</WorkspaceShell>;
}
