import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, User, Timer, Navigation, ShoppingBag, Users } from "lucide-react"; // 🛑 NEW: Added Users
import { calculateDistance } from "@/utils/distance";

// --- HELPERS ---
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

const getStatusColor = (status) => {
  switch (status) {
    case 'open': return 'bg-emerald-100 text-emerald-700';
    case 'fulfilled': return 'bg-amber-100 text-amber-700'; 
    case 'collected': return 'bg-blue-100 text-blue-700'; 
    case 'completed': return 'bg-slate-200 text-slate-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    case 'expired': return 'bg-slate-700 text-white';
    default: return 'bg-white/90 text-violet-700'; 
  }
};

const formatTimeLeft = (expiryDate) => {
  const diffMs = new Date(expiryDate) - new Date();
  if (diffMs <= 0) return "Expired";
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours > 24) return `${Math.floor(hours/24)}d ${hours%24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const getShortAddress = (address) => {
  if (!address) return "No location provided";
  const parts = address.split(',').map(p => p.trim());
  if (parts.length <= 2) return address;

  const cityIndex = parts.findIndex(p => /\b\d{5}\b/.test(p));
  if (cityIndex !== -1) {
    const city = parts[cityIndex].replace(/\b\d{5}\b/g, "").trim();
    const neighborhood = cityIndex > 0 ? parts[cityIndex - 1] : "";
    const state = parts[cityIndex + 1] || "";
    return [neighborhood, city, state].filter(Boolean).join(', ');
  }
  return parts.slice(0, 3).join(', ');
};

export default function RequestCard({ request, userLocation }) {
  const expiryObj = new Date(request.expiryDateTime);
  const hoursLeft = (expiryObj - new Date()) / (1000 * 60 * 60);

  // --- UPDATED: Synced with RequestMap.jsx legend ---
  const getUrgencyDetails = (hours) => {
    if (hours <= 0) return { textColor: "text-slate-500", iconColor: "text-slate-400", tag: "EXPIRED", tagBg: "bg-slate-500" };
    if (hours <= 3) return { textColor: "text-red-600", iconColor: "text-red-500", tag: "URGENT", tagBg: "bg-red-500 animate-pulse" };
    if (hours <= 12) return { textColor: "text-orange-600", iconColor: "text-orange-500", tag: "NEEDED SOON", tagBg: "bg-orange-500" };
    if (hours <= 24) return { textColor: "text-yellow-600", iconColor: "text-yellow-500", tag: "UNDER 24H", tagBg: "bg-yellow-500" };
    return { textColor: "text-violet-600", iconColor: "text-violet-500", tag: null, tagBg: "bg-violet-500" };
  };

  const urgency = getUrgencyDetails(hoursLeft);

  let distanceText = null;
  if (userLocation?.lat && request.latitude && request.longitude) {
    const dist = calculateDistance(userLocation.lat, userLocation.lon, request.latitude, request.longitude);
    if (dist !== null) {
      distanceText = dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(1)}km`;
    }
  }

  const expiryDate = expiryObj.toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const hasMultipleImages = request.imageURLs?.length > 1;

  return (
    <div className="block group h-full">
      <Card className="h-full rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white group-hover:shadow-md transition-all duration-300 p-0 flex flex-col">
        
        {request.imageURLs?.length > 0 ? (
          <div className="relative h-56 w-full bg-slate-100 shrink-0">
            <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
              {request.imageURLs.map((url, index) => (
                <div key={index} className="w-full h-full flex-shrink-0 snap-center relative">
                  <img
                    src={url}
                    alt={`${request.foodName} ${index + 1}`}
                    className="h-full w-full object-cover object-center absolute inset-0"
                  />
                </div>
              ))}
            </div>
            
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
              <Badge className={`${getStatusColor(request.status)} hover:opacity-80 border-none shadow-sm backdrop-blur px-2 py-0.5 uppercase text-[10px] font-bold`}>
                {request.status}
              </Badge>
              
              {urgency.tag && (
                <Badge className={`${urgency.tagBg} text-white border-none shadow-sm font-bold text-[10px]`}>
                  {urgency.tag}
                </Badge>
              )}
            </div>

            {hasMultipleImages && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/20 backdrop-blur-md px-2 py-1 rounded-full">
                {request.imageURLs.map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60" />
                ))}
              </div>
            )}
          </div>
        ) : (
          // --- NEW: PREMIUM DEFAULT FALLBACK ---
          <div className="relative h-56 w-full bg-gradient-to-br from-violet-50 to-violet-100/60 flex flex-col items-center justify-center shrink-0 overflow-hidden border-b border-violet-100/50">
            {/* Soft decorative background glows */}
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-violet-200/40 rounded-full blur-2xl"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-24 h-24 bg-blue-200/30 rounded-full blur-xl"></div>

            {/* Centered Icon & Label */}
            <div className="w-16 h-16 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-white z-10">
              <ShoppingBag className="w-7 h-7 text-violet-400 stroke-[2]" />
            </div>
            <span className="mt-3 text-[10px] font-black text-violet-400/80 uppercase tracking-widest z-10">
              Food Request
            </span>

            {/* Badges (Kept in the same spot for consistency) */}
            <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
              <Badge className={`${getStatusColor(request.status)} hover:opacity-80 border-none shadow-sm backdrop-blur px-2 py-0.5 uppercase text-[10px] font-bold`}>
                {request.status}
              </Badge>
              {urgency.tag && (
                <Badge className={`${urgency.tagBg} text-white border-none shadow-sm font-bold text-[10px]`}>
                  {urgency.tag}
                </Badge>
              )}
            </div>
          </div>
        )}

        <Link to={`/requests/${request.id}`} className="flex flex-col flex-1">
          <CardContent className="px-5 pb-5 pt-2 flex flex-col flex-1">
            
            <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest -mb-2 mt-2">
              <Timer className="w-3 h-3 mr-1" />
              Requested {formatTimeAgo(request.createdAt)}
            </div>

            <div className="space-y-1 mt-4">
              <div className="flex justify-between items-start gap-2">
                <h3 className="text-lg font-bold text-slate-900 leading-tight group-hover:text-violet-700 transition-colors line-clamp-2">
                  {request.foodName}
                </h3>
                <span className="text-base font-bold text-violet-600 shrink-0 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                  {request.quantity} <span className="text-xs font-medium text-slate-500">{request.quantityUnit}</span>
                </span>
              </div>
              {request.description && (
                <p className="text-sm text-slate-600 line-clamp-2 mt-1">{request.description}</p>
              )}
            </div>

            {/* 🛑 NEW: Request Type tags now pop visually */}
            {request.foodTags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {request.foodTags.map((tag) => {
                  const isRequestType = tag === "Personal" || tag === "Community Aid";
                  return (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className={
                        isRequestType 
                          ? "bg-violet-100 text-violet-800 text-[10px] font-bold border border-violet-200 flex items-center" 
                          : "bg-slate-50 text-slate-600 text-[10px] font-medium border border-slate-100"
                      }
                    >
                      {tag === "Personal" && <User className="w-2.5 h-2.5 mr-1" />}
                      {tag === "Community Aid" && <Users className="w-2.5 h-2.5 mr-1" />}
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-slate-100 grid gap-2 text-xs text-slate-600">
              
              <div className="flex items-start gap-2">
                <Clock className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${urgency.iconColor}`} />
                <span className="flex flex-wrap items-center gap-x-1.5 leading-snug">
                  <span className={`font-bold ${urgency.textColor}`}>
                    Needed by {formatTimeLeft(request.expiryDateTime)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    ({expiryDate})
                  </span>
                </span>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 w-full">
                  <span className="leading-snug flex-1">{getShortAddress(request.address)}</span>
                  {distanceText && (
                    <Badge variant="outline" className="h-4 px-1.5 py-0 text-[9px] border-violet-200 bg-violet-50 text-violet-600 font-bold rounded-sm shrink-0">
                      <Navigation className="w-2.5 h-2.5 mr-1" /> {distanceText}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{request.requesterName || "KindBite User"}</span>
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}