"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  role?: string | string[] | null;
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await authClient.admin.listUsers({ query: { limit: 100 } });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Failed to load users");
      return;
    }
    setUsers((data?.users as AdminUser[]) ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch, no external subscription to model this as
    load();
  }, []);

  async function toggleRole(user: AdminUser) {
    const isAdmin = user.role === "admin";
    const { error } = await authClient.admin.setRole({
      userId: user.id,
      role: isAdmin ? "user" : "admin",
    });
    if (error) {
      setError(error.message ?? "Failed to update role");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Admin — Users
        </h1>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {error && (
            <p className="border-b border-zinc-200 px-4 py-3 text-sm text-red-600 dark:border-zinc-800 dark:text-red-400">
              {error}
            </p>
          )}
          {loading ? (
            <p className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="px-4 py-3 text-zinc-950 dark:text-zinc-50">{u.name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {u.username ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {u.role ?? "user"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleRole(u)}
                        className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
                      >
                        {u.role === "admin" ? "Demote to user" : "Promote to admin"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
