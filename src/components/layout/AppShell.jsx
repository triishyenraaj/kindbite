import { Outlet } from "react-router-dom";
import Topbar from "@/components/layout/Topbar";
import MobileNav from "@/components/layout/MobileNav";
import { useAuth } from "@/features/auth/useAuth"; // Import the hook

export default function AppShell() {
  const { user } = useAuth(); // Get the current user state

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar />
      <main className="mx-auto max-w-md px-4 pb-24 pt-4 md:max-w-6xl">
        <Outlet />
      </main>
      
      {/* --- THE FIX: Only render MobileNav if a user exists --- */}
      {user && <MobileNav />}
    </div>
  );
}