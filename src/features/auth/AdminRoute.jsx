import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminRoute({ children }) {
  // Grab the new isAdmin boolean we just made!
  const { user, authLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-5 bg-white p-8 md:px-12 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-red-200 rounded-full animate-ping opacity-50"></div>
            <div className="relative bg-red-100 p-4 rounded-full text-red-600 shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Verifying Admin Privileges</h3>
            <div className="flex items-center justify-center gap-2 text-slate-500 font-semibold text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
              Checking security clearance...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 1. Kick out users who aren't logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. 🛑 THE Bouncer: Kick logged-in users who are NOT admins back to the homepage
  if (!isAdmin) {
    return <Navigate to="/" replace />; // Or redirect to an "Unauthorized" page
  }

  // If they pass, let them into the Admin Dashboard!
  return children;
}