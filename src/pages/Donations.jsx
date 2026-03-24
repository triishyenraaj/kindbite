import { useEffect, useState, useMemo } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  where, 
  onSnapshot 
} from "firebase/firestore";
import { db } from "@/services/firebase/config";
import DonationList from "@/features/donations/DonationList";
import DonationMap from "@/features/donations/DonationMap"; 
import DonationFeedFilters from "@/features/donations/DonationFeedFilters";
import { calculateDistance } from "@/utils/distance"; 
import { Loader2, Plus, History, Map as MapIcon, List as ListIcon } from "lucide-react"; 
import { Link } from "react-router-dom";

export default function Donations() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("list"); 

  // --- Filter & Sort States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(""); 
  const [selectedTags, setSelectedTags] = useState([]);
  const [maxDistance, setMaxDistance] = useState(50000); 
  const [minQuantity, setMinQuantity] = useState(1);
  const [userLocation, setUserLocation] = useState(null);
  const [sortBy, setSortBy] = useState("expiring_soon"); 
  const [expiryFilter, setExpiryFilter] = useState("all"); 

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => console.log("User denied location or error:", error)
      );
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "donations"), 
      where("status", "==", "available"), 
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
      
      setDonations(docs);
      setLoading(false);
    }, (error) => {
      console.error("Feed Listener Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredDonations = useMemo(() => {
    let result = donations.filter((donation) => {
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesBasic = 
          donation.foodName?.toLowerCase().includes(searchLower) ||
          donation.address?.toLowerCase().includes(searchLower);
        const matchesDesc = donation.description?.toLowerCase().includes(searchLower);
        const matchesTags = donation.foodTags?.some(tag => 
          tag.toLowerCase().includes(searchLower)
        );

        if (!matchesBasic && !matchesDesc && !matchesTags) return false;
      }

      if (selectedCategory && donation.foodType !== selectedCategory) return false;
      if (selectedTags.length > 0) {
        const hasAllTags = selectedTags.every((tag) => donation.foodTags?.includes(tag));
        if (!hasAllTags) return false;
      }
      if (minQuantity > 1 && donation.quantity < minQuantity) return false;
      if (userLocation && maxDistance < 50000 && donation.latitude && donation.longitude) {
        const dist = calculateDistance(userLocation.lat, userLocation.lon, donation.latitude, donation.longitude);
        if (dist !== null && dist > maxDistance) return false;
      }
      if (expiryFilter !== "all" && donation.expiryDateTime) {
        const now = new Date();
        const expiryDate = new Date(donation.expiryDateTime);
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
      } else if (sortBy === "nearest" && userLocation) {
        const distA = (a.latitude && a.longitude) ? calculateDistance(userLocation.lat, userLocation.lon, a.latitude, a.longitude) : Infinity;
        const distB = (b.latitude && b.longitude) ? calculateDistance(userLocation.lat, userLocation.lon, b.latitude, b.longitude) : Infinity;
        return (distA !== null ? distA : Infinity) - (distB !== null ? distB : Infinity);
      } else {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      }
    });

    return result;
  }, [donations, searchQuery, selectedCategory, selectedTags, maxDistance, minQuantity, userLocation, sortBy, expiryFilter]);

  return (
    /* RESPONSIVE: max-w-screen-2xl allows laptop expansion */
    <div className="mx-auto max-w-screen-2xl py-6 px-4 md:px-8 space-y-6 pb-24 min-h-screen relative">
      
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Community <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">Donations</span>
          </h2>
          <p className="text-slate-600">
            Browse food rescues available <span className="font-bold text-emerald-600 uppercase text-xs">Now</span>
          </p>
        </div>

        {/* View Toggle */}
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

      <DonationFeedFilters 
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
        selectedTags={selectedTags} setSelectedTags={setSelectedTags}
        maxDistance={maxDistance} setMaxDistance={setMaxDistance}
        minQuantity={minQuantity} setMinQuantity={setMinQuantity}
        sortBy={sortBy} setSortBy={setSortBy}
        expiryFilter={expiryFilter} setExpiryFilter={setExpiryFilter}
        userLocation={userLocation}
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-violet-600 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Scanning for food...</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {viewMode === "list" ? (
            /* RESPONSIVE: Grid changes from 1 col on phone to 3 or 4 cols on laptop */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <DonationList 
                donations={filteredDonations} 
                userLocation={userLocation} 
                isFiltered={searchQuery !== "" || selectedCategory !== "" || selectedTags.length > 0} 
              />
            </div>
          ) : (
            /* RESPONSIVE: Map becomes taller on laptop */
            <div className="w-full lg:h-[75vh] rounded-[2rem] overflow-hidden border border-slate-200 shadow-lg">
              <DonationMap donations={filteredDonations} userLocation={userLocation} />
            </div>
          )}
        </div>
      )}

      {/* RESPONSIVE: Floating buttons stay neatly on the right on all screens */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 flex flex-col items-center gap-3">
        
        <Link 
          to="/donation-activity" 
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-violet-600 shadow-lg border border-slate-100 hover:bg-violet-50 transition-all hover:scale-110"
        >
          <History className="w-5 h-5" />
        </Link>

        <Link 
          to="/donations/new" 
          className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/40 hover:bg-violet-700 transition-all hover:scale-110"
        >
          <Plus className="w-7 h-7" />
        </Link>
        
      </div>

    </div>
  );
}