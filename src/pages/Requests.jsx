import { useEffect, useState, useMemo } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  where, 
  onSnapshot 
} from "firebase/firestore";
import { db } from "@/services/firebase/config";

import RequestList from "@/features/requests/RequestList";
import RequestMap from "@/features/requests/RequestMap"; 
import RequestFeedFilters from "@/features/requests/RequestFeedFilters";
import { useAuth } from "@/features/auth/AuthContext";
import { calculateDistance } from "@/utils/distance"; 
import { Loader2, Plus, History, Map as MapIcon, List as ListIcon } from "lucide-react"; 
import { Link } from "react-router-dom";

// 🌟 ADDED IMPORTS FOR LOCATION CONTEXT & TOPBAR
import { useLocationContext } from "@/features/location/LocationContext";
import TopbarLocation from "@/components/TopbarLocation";

export default function Requests() {
  // 🌟 ADDED: Pull in the logged-in user to filter out their own posts
  const { user } = useAuth();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("list"); 

  // --- Filter & Sort States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(""); 
  const [selectedRequestType, setSelectedRequestType] = useState(""); 
  const [selectedTags, setSelectedTags] = useState([]);
  const [maxDistance, setMaxDistance] = useState(50000); 
  const [minQuantity, setMinQuantity] = useState(1);
  const [sortBy, setSortBy] = useState("expiring_soon"); 
  const [expiryFilter, setExpiryFilter] = useState("all"); 

  // 🌟 REPLACED LOCAL LOCATION STATE WITH GLOBAL CONTEXT
  const { anchorLocation } = useLocationContext();

  // 🌟 DELETED THE LOCAL navigator.geolocation useEffect HERE

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "requests"), 
      where("status", "==", "open"), 
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date(); 
      const docs = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((doc) => {
          if (!doc.expiryDateTime) return true; 
          return new Date(doc.expiryDateTime) > now;
        });
      
      setRequests(docs);
      setLoading(false);
    }, (error) => {
      console.error("Feed Listener Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRequests = useMemo(() => {
    let result = requests.filter((request) => {
      
      // 🌟 ADDED: Instantly hide the post if the logged-in user is the requester
      if (user && request.requesterId === user.uid) return false;

      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesBasic = 
          request.foodName?.toLowerCase().includes(searchLower) ||
          request.address?.toLowerCase().includes(searchLower);
        const matchesDesc = request.description?.toLowerCase().includes(searchLower);
        const matchesTags = request.foodTags?.some(tag => 
          tag.toLowerCase().includes(searchLower)
        );

        if (!matchesBasic && !matchesDesc && !matchesTags) return false;
      }

      if (selectedCategory && request.foodType !== selectedCategory) return false;
      if (selectedRequestType && !request.foodTags?.includes(selectedRequestType)) return false; 

      if (selectedTags.length > 0) {
        const hasAllTags = selectedTags.every((tag) => request.foodTags?.includes(tag));
        if (!hasAllTags) return false;
      }
      if (minQuantity > 1 && request.quantity < minQuantity) return false;
      
      // 🌟 MODIFIED: Replaced userLocation with anchorLocation
      if (anchorLocation && maxDistance < 50000 && request.latitude && request.longitude) {
        const dist = calculateDistance(anchorLocation.lat, anchorLocation.lon, request.latitude, request.longitude);
        if (dist !== null && dist > maxDistance) return false;
      }
      
      if (expiryFilter !== "all" && request.expiryDateTime) {
        const now = new Date();
        const expiryDate = new Date(request.expiryDateTime);
        const hoursLeft = (expiryDate - now) / (1000 * 60 * 60);
        if (expiryFilter === "less_than_24h" && hoursLeft > 24) return false;
        if (expiryFilter === "more_than_24h" && hoursLeft <= 24) return false;
      }

      return true; 
    });

    result.sort((a, b) => {
      if (sortBy === "expiring_soon") {
        const timeA = a.expiryDateTime ? new Date(a.expiryDateTime).getTime() : Infinity;
        const timeB = b.expiryDateTime ? new Date(b.expiryDateTime).getTime() : Infinity;
        return timeA - timeB; 
      } else if (sortBy === "nearest" && anchorLocation) { // 🌟 MODIFIED: Replaced userLocation with anchorLocation
        const distA = (a.latitude && a.longitude) ? calculateDistance(anchorLocation.lat, anchorLocation.lon, a.latitude, a.longitude) : Infinity;
        const distB = (b.latitude && b.longitude) ? calculateDistance(anchorLocation.lat, anchorLocation.lon, b.latitude, b.longitude) : Infinity;
        return (distA !== null ? distA : Infinity) - (distB !== null ? distB : Infinity);
      } else {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      }
    });

    return result;
  // 🌟 ADDED `user` to the dependency array below:
  }, [requests, searchQuery, selectedCategory, selectedRequestType, selectedTags, maxDistance, minQuantity, anchorLocation, sortBy, expiryFilter, user]); 

  return (
    <div className="mx-auto max-w-screen-2xl py-6 px-4 md:px-8 space-y-6 pb-24 min-h-screen relative">
      
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Community <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">Requests</span>
          </h2>
          <p className="text-slate-600">
            Help fulfill food needs in your area <span className="font-bold text-emerald-600 uppercase text-xs">Now</span>
          </p>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 mt-1 shadow-inner">
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg transition-all ${
              viewMode === "list" ? "bg-white text-violet-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`p-2 rounded-lg transition-all ${
              viewMode === "map" ? "bg-white text-violet-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <MapIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 🌟 ADDED: The new Top Bar Location Component */}
      <TopbarLocation />

      <RequestFeedFilters 
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
        selectedRequestType={selectedRequestType} setSelectedRequestType={setSelectedRequestType} 
        selectedTags={selectedTags} setSelectedTags={setSelectedTags}
        maxDistance={maxDistance} setMaxDistance={setMaxDistance}
        minQuantity={minQuantity} setMinQuantity={setMinQuantity}
        sortBy={sortBy} setSortBy={setSortBy}
        expiryFilter={expiryFilter} setExpiryFilter={setExpiryFilter}
        userLocation={anchorLocation} /* 🌟 MODIFIED */
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-violet-600 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Scanning for requests...</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {viewMode === "list" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <RequestList 
                requests={filteredRequests} 
                userLocation={anchorLocation} /* 🌟 MODIFIED */
                isFiltered={searchQuery !== "" || selectedCategory !== "" || selectedTags.length > 0} 
              />
            </div>
          ) : (
            <div className="w-full lg:h-[75vh] rounded-[2rem] overflow-hidden border border-slate-200 shadow-lg">
              <RequestMap requests={filteredRequests} userLocation={anchorLocation} /* 🌟 MODIFIED */ />
            </div>
          )}
        </div>
      )}

      {/* FLOATING ACTION BUTTONS */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 flex flex-col items-end gap-3">
        
        {/* History / Activity Button */}
        <Link 
          to="/request-activity" 
          className="flex h-12 md:h-14 items-center justify-center rounded-full bg-white text-violet-600 shadow-lg border border-slate-100 hover:bg-violet-50 transition-all hover:scale-105 px-3.5 md:px-4 group"
        >
          <History className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
          <span className="max-w-0 overflow-hidden transition-all duration-300 ease-in-out group-hover:max-w-[120px] md:group-hover:ml-2 text-sm font-bold text-slate-600 whitespace-nowrap">
            History
          </span>
        </Link>

        {/* Create New Request Button */}
        <Link 
          to="/requests/new" 
          className="flex h-14 md:h-16 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 hover:from-violet-700 hover:to-fuchsia-700 transition-all hover:scale-105 px-4 md:px-5 group"
        >
          <Plus className="w-6 h-6 md:w-7 md:h-7 shrink-0" />
          <span className="max-w-0 overflow-hidden transition-all duration-300 ease-in-out group-hover:max-w-[140px] md:group-hover:ml-2 font-bold text-base whitespace-nowrap">
            Request Food
          </span>
        </Link>
        
      </div>
    </div>
  );
}