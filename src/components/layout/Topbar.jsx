import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth"; 
import { getUserProfile } from "@/features/users/userService"; 

import logo from "@/assets/logo.png"; 

export default function Topbar() {
  const { user } = useAuth(); 
  const [profile, setProfile] = useState(null);

  // This grabs your custom Firestore details (like fullName) when the user logs in
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
          
          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 text-sm md:flex font-medium mr-4">
            <Link to="/" className="text-slate-600 hover:text-violet-600 transition-colors">
              Home
            </Link>
            
            {user && (
              <>
                <Link to="/donations" className="text-slate-600 hover:text-violet-600 transition-colors">
                  Donations
                </Link>
                {/* NEW: Requests Link added here */}
                <Link to="/requests" className="text-slate-600 hover:text-violet-600 transition-colors">
                  Requests
                </Link>
              </>
            )}

            {!user && (
              <Link to="/login" className="text-slate-600 hover:text-violet-600 transition-colors">
                Login
              </Link>
            )}
          </nav>

          {/* User Profile Indicator */}
          {user && (
            <Link 
              to="/profile" 
              className="flex items-center gap-3 p-1 pr-3 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              {/* Avatar Image or Fallback using the fetched 'profile' */}
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold">
                  {/* Safely get the first letter of their fullName */}
                  {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              
              {/* Show their full name from Firestore */}
              <span className="text-sm font-bold text-slate-700 hidden sm:block w-full max-w-[120px] truncate">
                {profile?.fullName || "Loading..."}
              </span>
            </Link>
          )}

        </div>

      </div>
    </header>
  );
}