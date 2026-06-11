import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { listenToNotifications, markNotificationAsRead } from "@/features/notifications/notificationService";
import { Bell, Star, Package, CheckCircle2, Clock, ShieldAlert } from "lucide-react";

// Helper to format time
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "Just now";
  const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Fetch notifications in real-time
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = listenToNotifications(user.uid, (data) => {
      setNotifications(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = async (notif) => {
    setIsOpen(false); 
    
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id);
    }

    // Intercept Admin Alerts
    if (notif.type === "admin_alert") {
      navigate("/admin/dashboard");
      return; 
    }

    // 🌟 THE FIX: Intercept Report Updates and route to My Reports
    if (notif.type === "report_update") {
      navigate("/profile/reports");
      return;
    }

    if (notif.referenceId) {
      // Look at the title or message. If it contains the word "Request" or "Fulfillment",
      // it came from the onRequestStatusChange trigger. Route it to /requests/
      const textToScan = `${notif.title} ${notif.message}`.toLowerCase();
      const isRequest = textToScan.includes("request") || textToScan.includes("fulfillment");
      
      const routePath = isRequest ? `/requests/${notif.referenceId}` : `/donations/${notif.referenceId}`;
      
      navigate(routePath);
    }
  };

  // Helper to pick the right icon based on notification type
  const getIcon = (type) => {
    switch (type) {
      case 'match_found': return <Star className="w-5 h-5 text-amber-500 fill-amber-500/20" />;
      case 'status_update': return <Package className="w-5 h-5 text-blue-500" />;
      case 'admin_alert': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'report_update': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default: return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* THE BELL BUTTON - UPDATED FOR SLEEKER LOOK */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 md:p-2 text-slate-500 hover:text-violet-600 transition-colors rounded-full hover:bg-slate-100 flex items-center justify-center"
      >
        {/* Shrunk from w-6 h-6 to w-5 h-5 */}
        <Bell className="w-5 h-5" />
        
        {unreadCount > 0 && (
          // Tweaked size, text, and positioning to fit the smaller bell
          <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white border-[1.5px] border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* THE DROPDOWN PANEL */}
      {isOpen && (
        <div className="fixed left-4 right-4 top-[72px] md:absolute md:left-auto md:right-0 md:top-auto md:mt-3 md:w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[999] overflow-hidden">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-extrabold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                {unreadCount} New
              </span>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
            {notifications.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center">
                <CheckCircle2 className="w-10 h-10 text-slate-200 mb-2" />
                <p className="text-sm font-medium text-slate-400">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-4 ${
                    !notif.isRead ? 'bg-violet-50/30' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-1 shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!notif.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Unread Dot */}
                  {!notif.isRead && (
                    <div className="w-2 h-2 rounded-full bg-violet-600 shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}