import { useEffect, useState } from "react";
// 🛑 NEW: Imported NavLink instead of Link for active states
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth"; 
import { getUserProfile } from "@/features/users/userService"; 

import logo from "@/assets/logo.png"; 
import NotificationBell from "@/components/layout/NotificationBell"; // 🌟 NEW: Import the Bell!

export default function Topbar() {
  const { user, isAdmin } = useAuth(); // 🛑 NEW: Grab isAdmin from context
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      if (user?.uid) {
        try {
          const data = await getUserProfile(user.uid);
          setProfile(data);
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
        }
      } else {
        setProfile(null);
      }
    }
    loadProfile();
  }, [user]);

  // 🛑 NEW: Helper function to handle active link styling
  const navLinkClass = ({ isActive }) => 
    `transition-colors font-bold ${
      isActive 
        ? "text-violet-600 underline underline-offset-8 decoration-2" 
        : "text-slate-600 hover:text-violet-600"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        
        {/* Logo Section */}
        <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <img 
            src={logo} 
            alt="KindBite Logo" 
            className="h-10 w-auto object-contain" 
          />
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">KindBite</h1>
            <p className="text-xs text-slate-500 hidden sm:block">Smart food rescue platform</p>
          </div>
        </Link>

        {/* Right Side: Navigation & User Profile */}
        <div className="flex items-center gap-4">
          
          <nav className="hidden items-center gap-6 text-sm md:flex font-medium mr-4">
            {/* 🛑 NEW: Using NavLink with the style helper */}
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            
            {user && (
              <>
                <NavLink to="/donations" className={navLinkClass}>
                  Donations
                </NavLink>
                <NavLink to="/requests" className={navLinkClass}>
                  Requests
                </NavLink>

                {/* 🛑 NEW: Admin Link (Only shows for Admins) */}
                {isAdmin && (
                  <NavLink to="/admin/dashboard" className={navLinkClass}>
                    Admin Dashboard
                  </NavLink>
                )}
              </>
            )}

            {!user && (
              <NavLink to="/login" className={navLinkClass}>
                Login
              </NavLink>
            )}
          </nav>

          {/* 🌟 NEW: The Notification Bell (Only shows if logged in) */}
          {user && (
            <div className="mr-1 md:mr-2 flex items-center">
              <NotificationBell />
            </div>
          )}

          {/* User Profile Indicator */}
          {user && (
            <Link 
              to="/profile" 
              className="flex items-center gap-3 p-1 pr-3 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
            >
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold">
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              
              <span className="text-sm font-bold text-slate-700 hidden sm:block max-w-[120px] truncate">
                {profile?.fullName || "Loading..."}
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}