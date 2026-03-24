import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore"; 
import { db } from "@/services/firebase/config"; 
import { 
  reserveDonation, 
  markAsCollected, 
  markAsCompleted,
  unreserveDonation,
  cancelDonation,
  expireDonation
} from "@/features/donations/donationService";
import { useAuth } from "@/features/auth/useAuth";
import { getUserProfile } from "@/features/users/userService"; 
import { calculateDistance } from "@/utils/distance"; 

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Info, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Loader2,
  PackageCheck,
  XCircle,
  AlertOctagon,
  Navigation,
  Map, 
  MessageCircle 
} from "lucide-react";

// --- HELPERS ---
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  return date.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  return date.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
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

// --- NEW HELPER: Bulletproof Date Parser ---
const getSafeDate = (val) => {
  if (!val) return new Date();
  return val.toMillis ? new Date(val.toMillis()) : new Date(val);
};

// --- NEW HELPER: Format Phone for WhatsApp API ---
const formatWhatsAppNumber = (phone) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, ''); // Remove all non-numeric characters
  return cleaned.startsWith('0') ? `6${cleaned}` : cleaned; // Ensure it starts with country code
};

export default function DonationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [donation, setDonation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.log("Location error:", error)
      );
    }
  }, []);

  // REAL-TIME LISTENER WITH LAZY AUTO-EXPIRE
  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, "donations", id);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const now = new Date();
        const expiry = getSafeDate(data.expiryDateTime);
        
        if (now > expiry && data.status === "available") {
          try {
            await expireDonation(docSnap.id);
          } catch (err) {
            console.error("Failed to auto-expire:", err);
          }
        }
        setDonation({ id: docSnap.id, ...data });
      } else {
        navigate("/donations");
      }
      setLoading(false);
    }, (error) => {
      console.error("Listener Error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id, navigate]);

  const handleUpdateStatus = async (nextStatus) => {
    const messages = {
      reserved: "Do you want to reserve this food? Please pick it up before the expiry time.",
      collected: "Confirm that you have physically collected this food?",
      completed: "Mark this donation as fully completed? This confirms the handover happened.",
      available: "Are you sure you want to cancel this reservation? The food will become available to others again."
    };

    if (!window.confirm(messages[nextStatus])) return;
    
    setUpdating(true);
    try {
      if (nextStatus === "reserved") {
        const profile = await getUserProfile(user.uid);
        await reserveDonation(
          id, 
          user.uid, 
          profile?.fullName || user.displayName || "Anonymous Rescuer", 
          profile?.phone || "No phone provided"
        );
      } else if (nextStatus === "collected") {
        await markAsCollected(id, user.uid);
      } else if (nextStatus === "completed") {
        await markAsCompleted(id, user.uid);
      } else if (nextStatus === "available") {
        await unreserveDonation(id);
      }
    } catch (error) {
      alert(error.message || "Update failed. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelPost = async () => {
    if (!window.confirm("Are you sure you want to cancel this donation post? It will be removed from the public feed.")) return;
    
    setUpdating(true);
    try {
      await cancelDonation(id);
    } catch (error) {
      alert("Failed to cancel donation. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !donation) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );

  const expiryDate = getSafeDate(donation.expiryDateTime).toLocaleString("en-MY", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const isOwner = user?.uid === donation.donorId;
  const isRecipient = user?.uid === donation.recipientId;

  // --- NEW: Universal Urgency Math ---
  const expiryObj = getSafeDate(donation.expiryDateTime);
  const isPastTime = new Date() > expiryObj;
  const isExpiredState = donation.status === "expired";
  const hoursLeft = (expiryObj - new Date()) / (1000 * 60 * 60);

  // Re-used the exact same logic from DonationCard
  const getUrgencyDetails = (hours) => {
    if (isPastTime || hours <= 0) return { 
      bg: "bg-slate-100", textColor: "text-slate-500", iconColor: "text-slate-500" 
    };
    if (hours <= 3) return { 
      bg: "bg-red-50", textColor: "text-red-600", iconColor: "text-red-600 animate-pulse" 
    };
    if (hours <= 12) return { 
      bg: "bg-orange-50", textColor: "text-orange-500", iconColor: "text-orange-500" 
    };
    if (hours <= 24) return { 
      bg: "bg-yellow-50", textColor: "text-yellow-500", iconColor: "text-yellow-500" 
    };
    return { 
      bg: "bg-emerald-50", textColor: "text-emerald-600", iconColor: "text-emerald-600" 
    };
  };

  const urgency = getUrgencyDetails(hoursLeft);

  let distanceText = null;
  if (userLocation?.lat && userLocation?.lng && donation.latitude && donation.longitude) {
    const dist = calculateDistance(userLocation.lat, userLocation.lng, donation.latitude, donation.longitude);
    if (dist !== null) {
      distanceText = dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(1)}km`;
    }
  }

  const renderTimelineStep = (label, timestamp, isDone, isLast = false) => {
    return (
      <div className="flex gap-4 min-h-[60px]">
        <div className="relative flex flex-col items-center">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isDone ? 'border-violet-600 text-violet-600' : 'border-slate-200'}`}>
            {isDone && <CheckCircle2 className="w-4 h-4" />}
          </div>
          {!isLast && (
            <div className={`absolute top-6 bottom-0 w-0.5 -mb-2 ${isDone ? 'bg-violet-600' : 'bg-slate-200'}`} />
          )}
        </div>
        <div className="pb-6 pt-0.5">
          <p className={`text-sm font-bold ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>{label}</p>
          {isDone && timestamp && (
             <p className="text-xs text-slate-500 font-medium">
               {formatDate(timestamp)} • {formatTime(timestamp)}
             </p>
          )}
        </div>
      </div>
    );
  };

  return (
    // OPTIMIZATION: max-w-screen-xl allows it to expand on laptops
    <div className="mx-auto max-w-screen-xl pb-24 relative min-h-screen bg-slate-50 md:bg-transparent md:pt-6">
      
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-white/80 md:bg-transparent px-4 py-3 backdrop-blur-md border-b md:border-none md:mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-white md:shadow-sm md:border md:border-slate-200 hover:bg-slate-100 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-bold text-slate-900 md:hidden">Donation Details</span>
        <div className="w-10" /> 
      </div>

      {/* MASTER GRID LAYOUT
        Phone: Stacks vertically via flex-col
        Laptop: 12-column grid
      */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-start gap-0 lg:gap-8 md:px-8">
        
        {/* --- LEFT COLUMN: IMAGE, DESCRIPTION, TIMELINE --- 
            Spans 7 columns on laptop 
        */}
        <div className="lg:col-span-7 flex flex-col gap-6 md:gap-8">
          
          {/* 1. Image Gallery */}
          <div className="relative h-80 md:h-[500px] w-full bg-slate-200 md:rounded-[2rem] overflow-hidden md:border md:border-slate-200 shadow-sm">
            {donation.imageURLs?.length > 0 ? (
              <>
                <img 
                  src={donation.imageURLs[currentImgIndex]} 
                  className={`h-full w-full object-cover shadow-inner ${isExpiredState ? 'grayscale opacity-80' : ''}`} 
                  alt="Food" 
                />
                {donation.imageURLs.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-between px-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full bg-black/20 text-white backdrop-blur-sm hover:bg-black/40"
                      onClick={() => setCurrentImgIndex(prev => prev === 0 ? donation.imageURLs.length - 1 : prev - 1)}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full bg-black/20 text-white backdrop-blur-sm hover:bg-black/40"
                      onClick={() => setCurrentImgIndex(prev => prev === donation.imageURLs.length - 1 ? 0 : prev + 1)}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </div>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {donation.imageURLs.map((_, i) => (
                    <div key={i} className={`h-1.5 w-1.5 rounded-full transition-all ${i === currentImgIndex ? "bg-white w-4" : "bg-white/50"}`} />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Info className="w-12 h-12" />
              </div>
            )}
          </div>

          {/* This wrapper hides Title/Info on laptop, but shows them on mobile */}
          <div className="lg:hidden px-5 space-y-6">
            <TitleAndInfo 
              donation={donation} 
              urgency={urgency} 
              isPastTime={isPastTime} 
              expiryDate={expiryDate} 
              distanceText={distanceText} 
              isOwner={isOwner} 
              isRecipient={isRecipient} 
            />
          </div>

          {/* 2. Description Section */}
          <div className="px-5 md:px-0 space-y-2">
            <h3 className="text-lg md:text-xl font-bold text-slate-900">Description</h3>
            <p className="text-slate-600 md:text-lg leading-relaxed bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 md:shadow-sm">
              {donation.description || "No specific description provided."}
            </p>
          </div>

          {/* 3. Timeline Section */}
          <div className="px-5 md:px-0">
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 md:shadow-sm space-y-4">
              <h3 className="text-lg md:text-xl font-extrabold text-slate-900 mb-2">Donation Journey</h3>
              <div className="pt-2 pl-2">
                {renderTimelineStep("Posted", donation.createdAt, true, donation.status === "available")}
                
                {donation.status === "cancelled" ? (
                  renderTimelineStep("Cancelled", donation.cancelledAt || donation.updatedAt, true, true)
                ) : donation.status === "expired" ? (
                  renderTimelineStep("Expired", donation.expiredAt || donation.updatedAt, true, true)
                ) : (
                  <>
                    {renderTimelineStep(
                      "Reserved", 
                      donation.reservedAt, 
                      ["reserved", "collected", "completed"].includes(donation.status),
                      donation.status === "reserved"
                    )}
                    {renderTimelineStep(
                      "Collected", 
                      donation.collectedAt, 
                      ["collected", "completed"].includes(donation.status),
                      donation.status === "collected"
                    )}
                    {renderTimelineStep(
                      "Completed", 
                      donation.completedAt, 
                      donation.status === "completed", 
                      true 
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* This wrapper hides Actions on laptop, but shows them on mobile at the very bottom */}
          <div className="lg:hidden px-5 pb-6">
            <ActionButtons 
              donation={donation} 
              isOwner={isOwner} 
              isRecipient={isRecipient} 
              updating={updating} 
              handleUpdateStatus={handleUpdateStatus} 
              handleCancelPost={handleCancelPost} 
              navigate={navigate} 
              id={id} 
            />
          </div>

        </div>

        {/* --- RIGHT COLUMN: TITLE, INFO, ACTIONS (LAPTOP ONLY) --- 
            Spans 5 columns and sticks to the top as the user scrolls the left column
        */}
        <div className="hidden lg:flex lg:col-span-5 flex-col space-y-6 sticky top-24 h-fit pb-8">
          <TitleAndInfo 
            donation={donation} 
            urgency={urgency} 
            isPastTime={isPastTime} 
            expiryDate={expiryDate} 
            distanceText={distanceText} 
            isOwner={isOwner} 
            isRecipient={isRecipient} 
          />
          <ActionButtons 
            donation={donation} 
            isOwner={isOwner} 
            isRecipient={isRecipient} 
            updating={updating} 
            handleUpdateStatus={handleUpdateStatus} 
            handleCancelPost={handleCancelPost} 
            navigate={navigate} 
            id={id} 
          />
        </div>

      </div>
    </div>
  );
}

// --- SUB-COMPONENTS TO PREVENT CODE DUPLICATION ---

function TitleAndInfo({ donation, urgency, isPastTime, expiryDate, distanceText, isOwner, isRecipient }) {
  return (
    <>
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">{donation.foodName}</h1>
          <Badge className={`
            border-none px-3 py-1 text-sm md:text-base font-bold rounded-full md:shadow-sm shrink-0
            ${donation.status === 'available' ? 'bg-emerald-100 text-emerald-700' : ''}
            ${donation.status === 'reserved' ? 'bg-amber-100 text-amber-700' : ''}
            ${donation.status === 'collected' ? 'bg-blue-100 text-blue-700' : ''}
            ${donation.status === 'completed' ? 'bg-slate-200 text-slate-700' : ''}
            ${donation.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
            ${donation.status === 'expired' ? 'bg-slate-700 text-white' : ''}
          `}>
            {donation.status.toUpperCase()}
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-violet-700 border-violet-200 bg-violet-50 text-xs md:text-sm">{donation.foodType}</Badge>
          <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-xs md:text-sm font-bold">Qty: {donation.quantity} {donation.quantityUnit}</Badge>
          {donation.foodTags?.map(tag => (
            <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-xs md:text-sm">{tag}</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 mt-6">
        <Card className="rounded-2xl md:rounded-3xl border-slate-100 shadow-sm md:overflow-hidden">
          <CardContent className="p-4 md:p-5 space-y-4 md:space-y-5">
            <div className="flex items-start gap-3 md:gap-4">
              <div className={`rounded-full md:rounded-2xl p-2 md:p-3 md:shadow-inner ${urgency.bg} ${urgency.iconColor}`}>
                <Clock className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold md:font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-widest mb-0.5">
                  {isPastTime ? "Expired" : "Expires In"}
                </p>
                <div className="flex flex-col">
                  <p className={`text-base md:text-lg font-bold md:font-black ${urgency.textColor}`}>
                    {isPastTime ? "Time has passed" : formatTimeLeft(donation.expiryDateTime)}
                  </p>
                  <p className="text-xs md:text-sm text-slate-400 md:text-slate-500 font-medium">{expiryDate}</p>
                </div>
              </div>
            </div>
            
            <div className="md:border-t md:border-slate-100"></div>

            <div className="flex items-start gap-3 md:gap-4">
              <div className="rounded-full md:rounded-2xl bg-blue-50 p-2 md:p-3 text-blue-600 shrink-0 md:shadow-inner">
                <MapPin className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                  <p className="text-xs font-semibold md:font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-widest">Pickup Location</p>
                  {distanceText && (
                    <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px] border-blue-200 bg-blue-50 text-blue-600 font-bold rounded-sm">
                      <Navigation className="w-2.5 h-2.5 mr-1" /> {distanceText}
                    </Badge>
                  )}
                </div>
                
                {/* NEW: Map Button Integration */}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm md:text-base font-medium md:font-semibold text-slate-700 leading-relaxed pr-2">{donation.address}</p>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${donation.latitude},${donation.longitude}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-[11px] font-bold transition-colors shadow-sm"
                  >
                    <Map className="w-3.5 h-3.5" /> Map
                  </a>
                </div>

              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl md:rounded-3xl border-slate-100 shadow-sm md:overflow-hidden">
          <CardContent className="p-4 md:p-5 space-y-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="rounded-full md:rounded-2xl bg-violet-50 p-2 md:p-3 text-violet-600 md:shadow-inner">
                <User className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold md:font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-widest mb-0.5">Donor</p>
                <p className="text-sm md:text-base font-bold text-slate-900">{donation.donorName}</p>
              </div>
            </div>
            
            { (isOwner || (isRecipient && donation.status !== "available" && donation.status !== "cancelled" && donation.status !== "expired")) && (
               <div className="flex items-center gap-3 md:gap-4 pt-4 border-t border-slate-50 md:border-slate-100">
                  <div className="rounded-full md:rounded-2xl bg-emerald-50 p-2 md:p-3 text-emerald-600 md:shadow-inner">
                    <Phone className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold md:font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-widest mb-0.5">Donor Contact</p>
                    
                    {/* NEW: WhatsApp & Call Integration for Donor */}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm md:text-base font-bold text-slate-900">{donation.contactNumber || "Not provided"}</p>
                      {donation.contactNumber && (
                        <div className="flex gap-2 shrink-0">
                          <a 
                            href={`https://wa.me/${formatWhatsAppNumber(donation.contactNumber)}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors shadow-sm"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Chat
                          </a>
                          <a 
                            href={`tel:${donation.contactNumber}`} 
                            className="flex items-center justify-center px-3 py-1.5 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-xl transition-colors shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
               </div>
            )}
          </CardContent>
        </Card>

        {isOwner && ["reserved", "collected", "completed"].includes(donation.status) && donation.recipientName && (
          <Card className="rounded-2xl md:rounded-3xl border-violet-100 bg-violet-50/50 shadow-none animate-in fade-in zoom-in duration-300">
            <CardContent className="p-4 md:p-5 space-y-3 md:space-y-4">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-violet-600" />
                <span className="text-xs font-bold md:font-black text-violet-800 uppercase tracking-wider md:tracking-widest">Recipient Found</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-violet-100/60">
                <div>
                  <p className="text-sm md:text-base font-bold text-slate-900">{donation.recipientName}</p>
                  <p className="text-xs md:text-sm text-slate-500 md:font-medium">{donation.recipientPhone}</p>
                </div>
                
                {/* NEW: WhatsApp & Call Integration for Recipient */}
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-white shadow-sm" asChild>
                    <a href={`https://wa.me/${formatWhatsAppNumber(donation.recipientPhone)}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="w-4 h-4 mr-1.5" />
                      Chat
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl border-violet-200 text-violet-600 md:text-violet-700 bg-white md:hover:bg-violet-100 shadow-sm" asChild>
                    <a href={`tel:${donation.recipientPhone}`}>
                      <Phone className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function ActionButtons({ donation, isOwner, isRecipient, updating, handleUpdateStatus, handleCancelPost, navigate, id }) {
  return (
    <>
      {isOwner && donation.status === "available" && (
        <div className="flex gap-3 pt-2 animate-in fade-in slide-in-from-bottom-4">
          <Button 
            variant="outline" 
            className="flex-1 rounded-2xl border-slate-200 text-slate-700 font-bold h-12 hover:bg-slate-50 shadow-sm"
            onClick={() => navigate(`/donations/edit/${id}`)}
            disabled={updating}
          >
            Edit Details
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 rounded-2xl border-red-200 text-red-600 font-bold h-12 hover:bg-red-50 hover:text-red-700 shadow-sm"
            onClick={handleCancelPost}
            disabled={updating}
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel Post"}
          </Button>
        </div>
      )}

      {donation.status !== "cancelled" && (
        <div className="pt-2 md:pt-0 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-lg md:text-xl font-extrabold text-slate-900">Update Status</h3>
            
            {donation.status === "expired" && (
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2">
                 <AlertOctagon className="w-6 h-6 text-slate-400" />
                 <p className="text-slate-600 text-sm font-bold">This food has expired.</p>
               </div>
            )}

            {donation.status === "available" && (
              <Button 
                className="w-full h-14 rounded-2xl bg-violet-600 text-white text-lg font-bold shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all active:scale-95"
                disabled={isOwner || updating}
                onClick={() => handleUpdateStatus("reserved")}
              >
                {updating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <CheckCircle2 className="w-6 h-6 mr-2" />}
                {isOwner ? "Waiting for a recipient..." : "Reserve This Food"}
              </Button>
            )}

            {donation.status === "reserved" && (
              isRecipient ? (
                <Button 
                  className="w-full h-14 rounded-2xl bg-blue-600 text-white text-lg font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                  disabled={updating}
                  onClick={() => handleUpdateStatus("collected")}
                >
                  {updating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <PackageCheck className="w-6 h-6 mr-2" />}
                  I've Collected the Food
                </Button>
              ) : (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                  <p className="text-amber-700 text-sm font-bold">
                    Food Reserved by {isOwner ? donation.recipientName : "Another User"}
                  </p>
                </div>
              )
            )}

            {donation.status === "collected" && (
              isOwner ? (
                <Button 
                  className="w-full h-14 rounded-2xl bg-emerald-600 text-white text-lg font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                  disabled={updating}
                  onClick={() => handleUpdateStatus("completed")}
                >
                  {updating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <CheckCircle2 className="w-6 h-6 mr-2" />}
                  Confirm Handover Finished
                </Button>
              ) : (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                  <p className="text-blue-700 text-sm font-bold">Waiting for Donor to Finalize</p>
                </div>
              )
            )}

            {donation.status === "completed" && (
              <div className="p-4 bg-slate-100 rounded-2xl text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-slate-400" />
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Handover Completed</p>
              </div>
            )}

            {donation.status === "reserved" && (isOwner || isRecipient) && (
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 font-bold transition-all mt-4"
                onClick={() => handleUpdateStatus("available")}
                disabled={updating}
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Cancel Reservation
              </Button>
            )}
          </div>
          
          <p className="text-center text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-tight md:tracking-widest px-10 leading-normal md:leading-relaxed mt-4">
            By updating the status, you agree to KindBite's guidelines for food safety and handovers.
          </p>
        </div>
      )}
    </>
  );
}