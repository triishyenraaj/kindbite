import { useState } from "react";
import { Search, MapPin, Users, ListFilter, Clock, ArrowUpDown, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FOOD_TAGS, FOOD_TYPES } from "@/utils/foodOptions";

export default function DonationFeedFilters({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedTags,
  setSelectedTags,
  maxDistance,
  setMaxDistance,
  minQuantity,
  setMinQuantity,
  sortBy,            
  setSortBy,         
  expiryFilter,      
  setExpiryFilter,
  userLocation,      
}) {
  // State to open/close the advanced filters
  const [showFilters, setShowFilters] = useState(false);

  // Count active advanced filters to show a notification dot
  const activeFilterCount = 
    (selectedCategory ? 1 : 0) + 
    (maxDistance < 50000 ? 1 : 0) + 
    (expiryFilter !== "all" ? 1 : 0) + 
    (minQuantity > 1 ? 1 : 0) +
    (sortBy !== "best_match" ? 1 : 0) +
    (selectedTags.length > 0 ? 1 : 0); // Include dietary tags in the count!

  // NEW: Instantly reset everything back to default values
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedTags([]);
    setMaxDistance(50000);
    setMinQuantity(1);
    setSortBy("best_match");
    setExpiryFilter("all");
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-4 mb-6">
      
      {/* 1. TOP ROW: Search Bar & Filter Toggle Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search food or locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
          />
        </div>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`relative flex items-center justify-center w-12 h-12 rounded-2xl border shadow-sm transition-all ${
            showFilters || activeFilterCount > 0
              ? "bg-violet-50 border-violet-200 text-violet-700" 
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {showFilters ? <X className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
          
          {/* Active filters notification dot */}
          {!showFilters && activeFilterCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-600 border-2 border-white"></span>
            </span>
          )}
        </button>
      </div>

      {/* 2. ADVANCED FILTERS MENU (Collapsible) */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-inner animate-in slide-in-from-top-2 fade-in duration-200">
          
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-700">Sort & Filter</h3>
              {activeFilterCount > 0 && (
                <span className="text-xs font-medium text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
                  {activeFilterCount} Active
                </span>
              )}
            </div>
            
            {/* NEW: Clear All Button */}
            {activeFilterCount > 0 && (
              <button 
                onClick={handleClearFilters}
                className="text-xs font-semibold text-slate-500 hover:text-violet-600 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Sort Dropdown */}
            <div className="relative col-span-2 sm:col-span-1">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => {
                  if (e.target.value === "nearest" && !userLocation) {
                    alert("Please enable location access in your browser to sort by distance.");
                    return; 
                  }
                  setSortBy(e.target.value);
                }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-violet-500 appearance-none"
              >
                <option value="newest">Newest First</option>
                <option value="expiring_soon">Expiring Soonest</option>
                <option value="nearest">Nearest First</option>
                <option value="best_match">Best Match</option>
              </select>
            </div>

            {/* Category Dropdown */}
            <div className="relative col-span-2 sm:col-span-1">
              <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-violet-500 appearance-none"
              >
                <option value="">All Categories</option>
                {FOOD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Distance Dropdown */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={maxDistance}
                onChange={(e) => {
                  if (Number(e.target.value) !== 50000 && !userLocation) {
                    alert("Please enable location access in your browser to filter by distance.");
                    return;
                  }
                  setMaxDistance(Number(e.target.value));
                }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-violet-500 appearance-none"
              >
                <option value={50000}>Any Distance</option>
                <option value={5}>Within 5 km</option>
                <option value={10}>Within 10 km</option>
                <option value={20}>Within 20 km</option>
              </select>
            </div>

            {/* Expiry Dropdown */}
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-violet-500 appearance-none"
              >
                <option value="all">Any Time Left</option>
                <option value="less_than_24h">Expiring Today (&lt;24h)</option>
                <option value="more_than_24h">Lasts &gt; 1 Day</option>
              </select>
            </div>

            {/* Pax Input (Spans full width on small screens) */}
            <div className="relative col-span-2">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                min="1"
                placeholder="Minimum portions (Pax)"
                value={minQuantity || ""}
                onChange={(e) => setMinQuantity(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. ALWAYS VISIBLE: Dietary Tags (Horizontal Scroll) */}
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x scrollbar-hide">
        {FOOD_TAGS.filter(tag => tag !== "No Restrictions").map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <Badge
              key={tag}
              onClick={() => toggleTag(tag)}
              variant={isSelected ? "default" : "outline"}
              className={`whitespace-nowrap cursor-pointer snap-start px-4 py-1.5 text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-violet-600 hover:bg-violet-700 text-white border-transparent"
                  : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {tag}
            </Badge>
          );
        })}
      </div>

    </div>
  );
}