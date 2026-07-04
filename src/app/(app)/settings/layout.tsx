import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { SettingsNav } from "./SettingsNav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  if (!can(user.role as AppRole, "system:access")) redirect("/dashboard");

  return (
    <div className="flex h-full">
      <SettingsNav />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
