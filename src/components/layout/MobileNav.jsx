import { useState } from "react";
// 🌟 NEW: Imported ShieldCheck for the Admin icon
import { Home, User, HandPlatter, Megaphone, Plus, X, HeartHandshake, FilePlus, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
// 🌟 NEW: Imported useAuth to check if the user is an admin
import { useAuth } from "@/features/auth/useAuth";

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  
  // 🌟 NEW: Get isAdmin status
  const { isAdmin } = useAuth();

  const leftItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/donations", label: "Donations", icon: HandPlatter },
  ];

  const rightItems = [
    { to: "/requests", label: "Requests", icon: Megaphone },
    { to: "/profile", label: "Profile", icon: User },
  ];

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const active = item.to === "/" 
      ? location.pathname === "/" 
      : location.pathname.startsWith(item.to);

    return (
      <Link
        to={item.to}
        className={`flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold transition-all duration-200 ${
          active ? "text-violet-700 scale-110" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <Icon size={22} className={active ? "stroke-[2.5px]" : "stroke-2"} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* BLUR OVERLAY */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* POPUP SPEED DIAL */}
      <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 transition-all duration-300 ease-out ${
        isOpen ? "translate-y-0 opacity-100 scale-100" : "translate-y-20 opacity-0 scale-90 pointer-events-none"
      }`}>
        
        {/* 🌟 NEW: Admin Dashboard Button (Only shows for Admins) */}
        {isAdmin && (
          <button
            onClick={() => { navigate("/admin/dashboard"); setIsOpen(false); }}
            className="flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl shadow-2xl border border-slate-800 active:scale-95 transition-transform w-full"
          >
            <div className="bg-slate-800 p-2 rounded-xl text-white">
              <ShieldCheck size={22} />
            </div>
            <span className="text-sm font-black text-white pr-4">Admin Dashboard</span>
          </button>
        )}

        <button
          onClick={() => { navigate("/donations/new"); setIsOpen(false); }}
          className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-100 active:scale-95 transition-transform w-full"
        >
          <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
            <HandPlatter size={22} />
          </div>
          <span className="text-sm font-black text-slate-700 pr-4">Give Food</span>
        </button>

        <button
          onClick={() => { navigate("/requests/new"); setIsOpen(false); }}
          className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-100 active:scale-95 transition-transform w-full"
        >
          <div className="bg-violet-100 p-2 rounded-xl text-violet-600">
            <Megaphone size={22} />
          </div>
          <span className="text-sm font-black text-slate-700">Ask for Food</span>
        </button>
      </div>

      {/* MAIN NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white pb-safe md:hidden shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.2)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-2 py-2 relative">
          
          {/* Left Side */}
          <div className="flex flex-1 justify-around items-center">
            {leftItems.map((item) => <NavItem key={item.to} item={item} />)}
          </div>

          {/* CENTRAL ACTION BUTTON */}
          <div className="relative -mt-12 px-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`flex h-16 w-16 items-center justify-center rounded-full shadow-2xl shadow-violet-300 transition-all duration-300 active:scale-90 ${
                isOpen 
                  ? "bg-slate-900 text-white rotate-45" 
                  : "bg-violet-600 text-white"
              }`}
            >
              <Plus size={36} strokeWidth={3} />
            </button>
          </div>

          {/* Right Side */}
          <div className="flex flex-1 justify-around items-center">
            {rightItems.map((item) => <NavItem key={item.to} item={item} />)}
          </div>

        </div>
      </nav>
    </>
  );
}