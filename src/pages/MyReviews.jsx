import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
// 🌟 MODIFIED: Added orderBy to the imports
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/services/firebase/config";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Star, 
  MessageSquare, 
  Heart, 
  Package, 
  Inbox, 
  Send,
  Loader2,
  ExternalLink 
} from "lucide-react";

// --- HELPER: Format Review Date ---
const formatReviewDate = (timestamp) => {
  if (!timestamp) return "Just now";
  const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

export default function MyReviews() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- TAB STATE ---
  const [mainTab, setMainTab] = useState("received"); // 'received' | 'sent'
  const [subTab, setSubTab] = useState("donor");      // 'donor' | 'recipient'

  // --- DATA STATE ---
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🌟 REAL-TIME LISTENERS: Fetch reviews live based on active tabs
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const reviewsRef = collection(db, "reviews");
    
    // 🌟 MODIFIED: Construct query with backend orderBy("createdAt", "desc")
    const q = mainTab === "received" 
      ? query(
          reviewsRef, 
          where("revieweeId", "==", user.uid), 
          where("revieweeRole", "==", subTab),
          orderBy("createdAt", "desc")
        )
      : query(
          reviewsRef, 
          where("reviewerId", "==", user.uid), 
          where("reviewerRole", "==", subTab),
          orderBy("createdAt", "desc")
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 🌟 SOFT DELETE FILTER: Ensure reviews hidden by admin don't show to user
      const visibleReviews = fetchedData.filter(r => !r.isHidden);
      
      setReviews(visibleReviews);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to reviews:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, mainTab, subTab]);

  // Calculate Average Rating dynamically based on visible reviews
  const stats = React.useMemo(() => {
    if (!reviews.length) return { average: 0, total: 0 };
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return {
      average: (sum / reviews.length).toFixed(1),
      total: reviews.length
    };
  }, [reviews]);

  const isDonor = subTab === "donor";

  // Navigation Handler
  const handleNavigation = (item) => {
    if (item.flowType === "request" && item.requestId) {
      navigate(`/requests/${item.requestId}`);
    } else if (item.donationId) {
      navigate(`/donations/${item.donationId}`);
    }
  };

  return (
    <div className="mx-auto max-w-screen-md pb-24 min-h-screen bg-slate-50 md:bg-transparent md:pt-6">
      
      {/* HEADER */}
      <div className="sticky top-0 z-30 flex items-center bg-white/80 md:bg-transparent px-4 py-3 backdrop-blur-md border-b md:border-none md:mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-white md:shadow-sm md:border hover:bg-slate-100 transition-all mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl md:text-3xl font-extrabold text-slate-900">My Reputation</h1>
      </div>

      <div className="px-4 md:px-0 space-y-6">
        
        {/* MAIN TABS (Received vs Sent) */}
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl">
          <button 
            onClick={() => setMainTab("received")} 
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              mainTab === "received" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Inbox className="w-4 h-4" /> Reviews Received
          </button>
          <button 
            onClick={() => setMainTab("sent")} 
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              mainTab === "sent" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Send className="w-4 h-4" /> Reviews Sent
          </button>
        </div>

        {/* SUB TABS (Donor vs Recipient) */}
        <div className="flex gap-3">
          <Button 
            variant={isDonor ? "default" : "outline"}
            onClick={() => setSubTab("donor")}
            className={`flex-1 h-12 rounded-2xl font-bold ${
              isDonor ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200" : "border-slate-200 text-slate-600 bg-white"
            }`}
          >
            <Heart className={`w-4 h-4 mr-2 ${isDonor ? "text-violet-200" : "text-violet-500"}`} />
            As a Donor
          </Button>
          <Button 
            variant={!isDonor ? "default" : "outline"}
            onClick={() => setSubTab("recipient")}
            className={`flex-1 h-12 rounded-2xl font-bold ${
              !isDonor ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200" : "border-slate-200 text-slate-600 bg-white"
            }`}
          >
            <Package className={`w-4 h-4 mr-2 ${!isDonor ? "text-blue-200" : "text-blue-500"}`} />
            As a Recipient
          </Button>
        </div>

        {/* STATS HEADER */}
        <div className={`p-6 md:p-8 rounded-[2rem] border flex items-center justify-between shadow-sm transition-colors duration-300 ${
          isDonor ? "bg-violet-50/50 border-violet-100" : "bg-blue-50/50 border-blue-100"
        }`}>
          <div>
            <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
              isDonor ? "text-violet-500" : "text-blue-500"
            }`}>
              {mainTab === "received" ? "Average Rating" : "Average Given"}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-5xl font-black text-slate-900">{stats.average}</p>
              <Star className={`w-8 h-8 fill-current ${stats.average > 0 ? "text-amber-400" : "text-slate-300"}`} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-700">{stats.total}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</p>
          </div>
        </div>

        {/* REVIEWS LIST */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[2rem] border border-dashed border-slate-200">
              <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No reviews found in this category.</p>
            </div>
          ) : (
            reviews.map((item) => (
              <Card key={item.id} className="rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col items-start pr-4">
                      {/* 🌟 MODIFIED: Wrapped names in clickable spans pointing to public profile */}
                      {mainTab === "received" ? (
                        <p className="font-bold text-slate-900 text-sm">
                          <span className="text-slate-400 font-normal mr-1">From</span> 
                          <span 
                            onClick={() => navigate(`/user/${item.reviewerId}`)}
                            className="cursor-pointer hover:text-violet-600 hover:underline transition-colors"
                            title="View public profile"
                          >
                            {item.reviewerName || "Unknown User"}
                          </span>
                        </p>
                      ) : (
                        <p className="font-bold text-slate-900 text-sm">
                          <span className="text-slate-400 font-normal mr-1">To</span> 
                          <span 
                            onClick={() => navigate(`/user/${item.revieweeId}`)}
                            className="cursor-pointer hover:text-violet-600 hover:underline transition-colors"
                            title="View public profile"
                          >
                            {item.revieweeName || "Unknown User"}
                          </span>
                        </p>
                      )}

                      <button 
                        onClick={() => handleNavigation(item)}
                        className="group flex items-center gap-1.5 mt-1.5 text-left active:scale-[0.98] transition-transform"
                      >
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] uppercase font-black px-1.5 py-0 border leading-tight ${
                            item.flowType === 'request' 
                              ? 'text-blue-600 bg-blue-50 border-blue-200' 
                              : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          {item.flowType === 'request' ? 'Request' : 'Donation'}
                        </Badge>
                        
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider group-hover:text-violet-600 group-hover:underline transition-colors line-clamp-1">
                          {item.transactionTitle || item.donationTitle || "Food Item"}
                        </span>
                        <ExternalLink className="w-3 h-3 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    </div>
                    
                    <div className="flex flex-col items-end shrink-0 pt-0.5">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < item.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                        ))}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                        {formatReviewDate(item.createdAt)}
                      </span>
                    </div>
                  </div>
                  {item.comment && (
                    <p className="text-sm text-slate-600 italic bg-slate-50 p-3.5 rounded-2xl leading-relaxed">
                      "{item.comment}"
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}