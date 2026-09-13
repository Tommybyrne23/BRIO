import { requireUser } from "@/db/auth-dal";
import { getPreferencesForUser } from "@/db/queries/product-state";
import { ProfileEditor } from "@/components/profile-editor";

export default async function ProfilePage() {
  const user = await requireUser();
  const preferences = await getPreferencesForUser(user.id);
  return <ProfileEditor account={{ name: user.name, email: user.email, username: user.username, role: user.role }} initial={preferences}/>;
}
