import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase/config"; 
import { useAuth } from "@/features/auth/useAuth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Loader2, 
  PackageOpen, 
  MapPin, 
  Calendar,
  Star,
  Trophy // 🌟 NEW: Added for Reputation Button
} from "lucide-react";

// --- HELPER: Format Date and Time ---
const formatDateTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export default function RequestActivity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 'requests' = Things the user asked for. 'fulfillments' = Things the user is giving.
  const [activeTab, setActiveTab] = useState("requests"); 
  const [subFilter, setSubFilter] = useState("all"); 
  const [myRequests, setMyRequests] = useState([]);
  const [myFulfillments, setMyFulfillments] = useState([]);
  const [reviewedIds, setReviewedIds] = useState(new Set()); // 🌟 NEW: Tracks reviewed requests
  const [loading, setLoading] = useState(true);

  // REAL-TIME LISTENERS
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Query 1: Requests created by the user (They need food)
    const qRequests = query(collection(db, "requests"), where("requesterId", "==", user.uid));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = results.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setMyRequests(sorted);
    });

    // Query 2: Requests the user has stepped up to fulfill (They are giving food)
    const qFulfillments = query(collection(db, "requests"), where("donorId", "==", user.uid));
    const unsubFulfillments = onSnapshot(qFulfillments, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = results.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setMyFulfillments(sorted);
    });

    // 🌟 Query 3: Fetch Reviews I have written (to cross-check with completed requests)
    const qReviews = query(collection(db, "reviews"), where("reviewerId", "==", user.uid));
    const unsubReviews = onSnapshot(qReviews, (snapshot) => {
      // Maps out the requestId for reviews written by the current user
      const ids = new Set(snapshot.docs.map(doc => doc.data().requestId).filter(Boolean));
      setReviewedIds(ids);
      setLoading(false); 
    });

    return () => {
      unsubRequests();
      unsubFulfillments();
      unsubReviews();
    };
  }, [user]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSubFilter("all");
  };

  const getDisplayStatus = (item) => {
    if (item.status === 'expired') return 'expired';
    if (item.status === 'open' && item.expiryDateTime && new Date() > new Date(item.expiryDateTime)) {
      return 'expired'; 
    }
    return item.status;
  };

  // 🌟 FILTER LOGIC UPDATED TO SUPPORT "to review"
  const filteredItems = (activeTab === "requests" ? myRequests : myFulfillments).filter(item => {
    const displayStatus = getDisplayStatus(item);
    
    if (subFilter === "all") return true;
    if (subFilter === "to review") {
      return displayStatus === "completed" && !reviewedIds.has(item.id);
    }
    return displayStatus === subFilter;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'open': return 'bg-violet-100 text-violet-700'; 
      case 'fulfilled': return 'bg-amber-100 text-amber-700';
      case 'collected': return 'bg-emerald-100 text-emerald-700';
      case 'completed': return 'bg-slate-200 text-slate-700';
      case 'to review': return 'bg-violet-100 text-violet-700'; // Standardized badge style
      case 'cancelled': return 'bg-red-100 text-red-700'; 
      case 'expired': return 'bg-slate-700 text-white'; 
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const renderFilterChips = () => {
    // 🌟 ADDED "to review"
    const filters = activeTab === "requests" 
      ? ["all", "open", "fulfilled", "collected", "completed", "to review", "expired", "cancelled"] 
      : ["all", "fulfilled", "collected", "completed", "to review", "expired"]; 

    return (
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide md:justify-center">
        {filters.map((f) => {
          const isActive = subFilter === f;
          
          // Uniform styling for all chips
          const btnClass = isActive 
            ? "bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200" 
            : "bg-white border-slate-200 text-slate-500 hover:border-violet-300";

          return (
            <button
              key={f}
              onClick={() => setSubFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${btnClass}`}
            >
              {f === "fulfilled" && activeTab === "fulfillments" ? "TO BE HANDED OVER" : f.toUpperCase()}
            </button>
          )
        })}
      </div>
    );
  };

  const renderList = (items) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 mt-2">
          <PackageOpen className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm italic px-6">
            No {subFilter !== "all" ? subFilter : ""} requests found here.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        {items.map(item => {
          const displayStatus = getDisplayStatus(item);
          const isInactive = displayStatus === "cancelled" || displayStatus === "expired";
          
          // 🌟 Check if this item needs a review
          const needsReview = displayStatus === "completed" && !reviewedIds.has(item.id);

          return (
            <Link 
              to={`/requests/${item.id}`} 
              key={item.id}
              className={`flex flex-col h-full p-4 bg-white rounded-2xl border shadow-sm hover:border-violet-300 hover:shadow-md transition-all active:scale-[0.98] overflow-hidden ${
                isInactive ? "opacity-75 border-slate-100" : "border-slate-100"
              }`}
            >
              <div className="flex gap-4 mb-3">
                <img 
                  src={item.imageURLs?.[0] || "https://placehold.co/100x100?text=Request"} 
                  alt={item.foodName}
                  className={`w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover bg-slate-100 flex-shrink-0 ${isInactive ? 'grayscale opacity-80' : ''}`}
                />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className={`font-bold truncate leading-tight ${displayStatus === 'cancelled' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                    {item.foodName}
                  </h3>
                  
                  <div className="flex items-center text-slate-500 text-[11px] mt-1 min-w-0">
                    <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                    <p className="truncate flex-1">{item.address}</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center text-slate-400 text-[10px] font-medium uppercase tracking-tight">
                  <Calendar className="w-2.5 h-2.5 mr-1" />
                  {formatDateTime(item.createdAt)}
                </div>
                
                {/* 🌟 DYNAMIC BADGE LOGIC */}
                {needsReview ? (
                  <Badge className="w-fit border px-2 py-0.5 text-[9px] font-black rounded shadow-sm bg-white text-amber-600 border-amber-400 flex items-center gap-1 animate-in zoom-in duration-300">
                    <Star className="w-2.5 h-2.5 fill-current" /> LEAVE REVIEW
                  </Badge>
                ) : (
                  <Badge className={`w-fit border-none px-2 py-0.5 text-[10px] font-black rounded shadow-sm ${getStatusColor(displayStatus)}`}>
                    {displayStatus === "fulfilled" && activeTab === "fulfillments" ? "FULFILLED" : displayStatus.toUpperCase()}
                  </Badge>
                )}

              </div>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-screen-xl pb-24 relative min-h-screen bg-slate-50 overflow-x-hidden md:pt-6">
      
      {/* 🌟 HEADER WITH REPUTATION BUTTON */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-white/80 md:bg-transparent px-4 py-3 backdrop-blur-md border-b md:border-none md:mb-2">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full mr-2 md:bg-white md:border md:border-slate-200 md:shadow-sm hover:bg-slate-100 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-slate-900 text-lg md:text-2xl">Request Activity</h1>
        </div>

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate("/profile/reviews")} // 🌟 UPDATED URL ROUTE
          className="rounded-full bg-white border-violet-200 text-violet-700 font-bold hover:bg-violet-50 text-[11px] md:text-xs h-8 px-3 shadow-sm"
        >
          <Trophy className="w-3.5 h-3.5 mr-1.5" />
          My Reputation
        </Button>
      </div>

      <div className="px-4 md:px-8 py-6">
        
        {/* Main Tabs */}
        <div className="flex p-1 bg-slate-200/60 rounded-xl mb-6 shadow-inner md:max-w-md mx-auto">
          <button
            onClick={() => handleTabChange("requests")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === "requests" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            I'm Requesting
          </button>
          <button
            onClick={() => handleTabChange("fulfillments")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === "fulfillments" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            I'm Fulfilling
          </button>
        </div>

        {/* Sub-Filters Chips */}
        {!loading && renderFilterChips()}

        {/* List content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-violet-600" />
            <p className="text-sm font-medium text-slate-400">Fetching your activity...</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {renderList(filteredItems)}
          </div>
        )}
      </div>
    </div>
  );
}