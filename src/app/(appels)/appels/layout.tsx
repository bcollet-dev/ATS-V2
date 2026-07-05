import { requireAuth } from "@/lib/auth";
import AppelsNav from "./_components/AppelsNav";

export default async function AppelsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <div
          className="h-7 w-7 rounded-md"
          style={{ backgroundColor: "var(--color-eda-orange)" }}
        />
        <span className="text-base font-semibold text-gray-900">EDA Appels</span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      <AppelsNav />
    </div>
  );
}
