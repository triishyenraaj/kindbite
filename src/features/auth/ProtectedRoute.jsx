import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { Loader2, ShieldCheck } from "lucide-react";

export default function ProtectedRoute({ children, requireProfile = true }) {
  // We grab all three values instantly from global state!
  const { user, authLoading, profileCompleted } = useAuth();
  const location = useLocation();

  // If the app is still figuring out who the user is OR fetching their profile
  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-5 bg-white p-8 md:px-12 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-violet-200 rounded-full animate-ping opacity-50"></div>
            <div className="relative bg-violet-100 p-4 rounded-full text-violet-600 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Securing Connection</h3>
            <div className="flex items-center justify-center gap-2 text-slate-500 font-semibold text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
              Verifying access...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Kick out users who aren't logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Kick logged-in users to onboarding if they haven't finished it
  if (requireProfile && !profileCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  // If they pass all checks, let them in instantly!
  return children;
}