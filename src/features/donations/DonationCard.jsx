import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, User, Timer, Navigation } from "lucide-react";
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
    case 'available': return 'bg-emerald-100 text-emerald-700';
    case 'reserved': return 'bg-amber-100 text-amber-700';
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

export default function DonationCard({ donation, userLocation }) {
  const expiryObj = new Date(donation.expiryDateTime);
  const hoursLeft = (expiryObj - new Date()) / (1000 * 60 * 60);

  const getUrgencyDetails = (hours) => {
    if (hours <= 0) return { textColor: "text-slate-500", iconColor: "text-slate-400", tag: "EXPIRED", tagBg: "bg-slate-500" };
    if (hours <= 3) return { textColor: "text-red-600", iconColor: "text-red-500", tag: "URGENT", tagBg: "bg-red-500 animate-pulse" };
    if (hours <= 12) return { textColor: "text-orange-600", iconColor: "text-orange-500", tag: "EXPIRING SOON", tagBg: "bg-orange-500" };
    if (hours <= 24) return { textColor: "text-yellow-500", iconColor: "text-yellow-500", tag: null };
    return { textColor: "text-emerald-600", iconColor: "text-emerald-500", tag: null };
  };

  const urgency = getUrgencyDetails(hoursLeft);

  let distanceText = null;
  if (userLocation?.lat && donation.latitude && donation.longitude) {
    const dist = calculateDistance(userLocation.lat, userLocation.lon, donation.latitude, donation.longitude);
    if (dist !== null) {
      distanceText = dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(1)}km`;
    }
  }

  const expiryDate = expiryObj.toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const hasMultipleImages = donation.imageURLs?.length > 1;

  return (
    <div className="block group h-full">
      <Card className="h-full rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white group-hover:shadow-md transition-all duration-300 p-0 flex flex-col">
        
        {donation.imageURLs?.length > 0 ? (
          <div className="relative h-56 w-full bg-slate-100 shrink-0">
            <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
              {donation.imageURLs.map((url, index) => (
                <div key={index} className="w-full h-full flex-shrink-0 snap-center relative">
                  <img
                    src={url}
                    alt={`${donation.foodName} ${index + 1}`}
                    className="h-full w-full object-cover object-center absolute inset-0"
                  />
                </div>
              ))}
            </div>
            
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
              <Badge className={`${getStatusColor(donation.status)} hover:opacity-80 border-none shadow-sm backdrop-blur px-2 py-0.5 uppercase text-[10px] font-bold`}>
                {donation.status}
              </Badge>
              
              {urgency.tag && (
                <Badge className={`${urgency.tagBg} text-white border-none shadow-sm font-bold text-[10px]`}>
                  {urgency.tag}
                </Badge>
              )}
            </div>

            {hasMultipleImages && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/20 backdrop-blur-md px-2 py-1 rounded-full">
                {donation.imageURLs.map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/60" />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-16 w-full bg-violet-50 flex items-center justify-between px-5 border-b border-violet-100 shrink-0">
             <Badge className={`${getStatusColor(donation.status)} hover:opacity-80 border-none shadow-sm uppercase font-bold`}>
               {donation.status}
             </Badge>
          </div>
        )}

        <Link to={`/donations/${donation.id}`} className="flex flex-col flex-1">
          <CardContent className="px-5 pb-5 pt-2 flex flex-col flex-1">
            
            <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest -mb-2">
              <Timer className="w-3 h-3 mr-1" />
              Posted {formatTimeAgo(donation.createdAt)}
            </div>

            <div className="space-y-1 mt-4">
              <div className="flex justify-between items-start gap-2">
                {/* Allowed title to wrap up to 2 lines if needed */}
                <h3 className="text-lg font-bold text-slate-900 leading-tight group-hover:text-violet-700 transition-colors line-clamp-2">
                  {donation.foodName}
                </h3>
                <span className="text-base font-bold text-violet-600 shrink-0 bg-violet-50 px-2 py-0.5 rounded-md">
                  {donation.quantity} <span className="text-xs font-medium text-slate-500">{donation.quantityUnit}</span>
                </span>
              </div>
              {donation.description && (
                <p className="text-sm text-slate-600 line-clamp-2 mt-1">{donation.description}</p>
              )}
            </div>

            {/* RESTORED: Shows ALL tags and lets them wrap naturally */}
            {donation.foodTags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {donation.foodTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-slate-50 text-slate-600 text-[10px] font-medium border border-slate-100">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-slate-100 grid gap-2 text-xs text-slate-600">
              
              {/* RESTORED: Full Expiry date + Time left, allowed to wrap if needed */}
              <div className="flex items-start gap-2">
                <Clock className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${urgency.iconColor}`} />
                <span className="flex flex-wrap items-center gap-x-1.5 leading-snug">
                  <span className={`font-bold ${urgency.textColor}`}>
                    Expires {formatTimeLeft(donation.expiryDateTime)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    ({expiryDate})
                  </span>
                </span>
              </div>

              {/* RESTORED: Full Address, allowed to wrap to multiple lines naturally */}
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 w-full">
                  <span className="leading-snug flex-1">{getShortAddress(donation.address)}</span>
                  {distanceText && (
                    <Badge variant="outline" className="h-4 px-1.5 py-0 text-[9px] border-blue-200 bg-blue-50 text-blue-600 font-bold rounded-sm shrink-0">
                      <Navigation className="w-2.5 h-2.5 mr-1" /> {distanceText}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{donation.donorName || "KindBite User"}</span>
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}