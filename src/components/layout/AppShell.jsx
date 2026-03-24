import { Outlet } from "react-router-dom";
import Topbar from "@/components/layout/Topbar";
import MobileNav from "@/components/layout/MobileNav";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar />
      <main className="mx-auto max-w-md px-4 pb-24 pt-4 md:max-w-6xl">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}