import { requireUser } from "@/db/auth-dal";
import { NavBar } from "@/components/nav-bar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <NavBar
        user={{
          name: user.name,
          email: user.email,
          role: user.role ?? "user",
        }}
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
