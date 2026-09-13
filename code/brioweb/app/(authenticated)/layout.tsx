import { requireUser } from "@/db/auth-dal";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <WorkspaceShell user={{ name: user.name, email: user.email, role: user.role ?? "user" }}>{children}</WorkspaceShell>;
}
