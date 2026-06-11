import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase/config";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, ShieldCheck, Star, AlertOctagon, Loader2, MessageSquare, Flame
} from "lucide-react";

// --- 🌟 HELPER: Format Date ---
const formatReviewDate = (timestamp) => {
  if (!timestamp) return "Just now";
  const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  return date.toLocaleDateString('en-MY', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function PublicUserView() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [targetUser, setTargetUser] = useState(null);
  const [reputation, setReputation] = useState({ average: 0, total: 0 });
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    // Fetch User Data
    const unsubUser = onSnapshot(doc(db, "users", id), (docSnap) => {
      if (docSnap.exists()) {
        setTargetUser({ id: docSnap.id, ...docSnap.data() });
      } else {
        setTargetUser(null);
      }
    });

    // Fetch Reviews (Only visible ones for the public view)
    const qReviews = query(collection(db, "reviews"), where("revieweeId", "==", id));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const fetchedReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(r => !r.isHidden) // 🔒 Security: Never show hidden reviews to public
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        
      setReviews(fetchedReviews);
      
      if (fetchedReviews.length > 0) {
        const totalScore = fetchedReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
        setReputation({
          average: (totalScore / fetchedReviews.length).toFixed(1),
          total: fetchedReviews.length
        });
      } else {
        setReputation({ average: 0, total: 0 });
      }
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubReviews();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // 🔒 Security: Do not render if user is suspended or doesn't exist
  if (!targetUser || targetUser.status === 'suspended') {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-[60vh]">
        <AlertOctagon className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-500">User not found or unavailable</h2>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-6 md:py-10 px-4 sm:px-6 space-y-6 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Top Header Navigation */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-slate-50 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-black text-slate-900 truncate">Public Profile</h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">KindBite Community Member</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* --- LEFT COLUMN: Identity --- */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-28">
          <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">
              <div className={`absolute top-0 inset-x-0 h-24 ${targetUser.role === 'admin' ? 'bg-violet-600' : 'bg-slate-200'}`}></div>
              
              <Avatar className="w-28 h-28 border-4 border-white shadow-lg mt-6 mb-4 relative z-10">
                <AvatarImage src={targetUser.photoURL} className="object-cover" />
                <AvatarFallback className="text-3xl font-black bg-slate-100 text-slate-600">
                  {targetUser.fullName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              
              <h2 className="text-2xl font-black text-slate-900 break-words w-full px-2">{targetUser.fullName || "Community Member"}</h2>
              
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {targetUser.role === "admin" && (
                  <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-none px-3 py-1">
                    <ShieldCheck className="w-3 h-3 mr-1.5"/> Admin
                  </Badge>
                )}
                <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 px-3 py-1">
                  <Flame className="w-3 h-3 mr-1.5"/> {targetUser.kindPoints || 0} KP
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Metrics */}
          <Card className="rounded-[2rem] border-slate-200 bg-amber-50/50 shadow-sm border-amber-100/50">
            <CardContent className="p-6 text-center flex justify-around items-center">
              <div>
                <Star className="w-6 h-6 text-amber-500 fill-amber-500 mx-auto mb-2" />
                <h3 className="text-2xl font-black text-amber-700">{reputation.average > 0 ? reputation.average : "N/A"}</h3>
                <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest mt-1">Trust Score</p>
              </div>
              <div className="w-px h-12 bg-amber-200/50"></div>
              <div>
                <MessageSquare className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <h3 className="text-2xl font-black text-amber-700">{reputation.total}</h3>
                <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest mt-1">Total Reviews</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- RIGHT COLUMN: Activity Feed --- */}
        <div className="lg:col-span-8 space-y-6 w-full min-w-0">
          
          {/* Reviews Section */}
          <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 sm:p-6">
              <CardTitle className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-violet-500" /> Community Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reviews.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium italic">
                  This user doesn't have any reviews yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reviews.map(review => (
                    <div key={review.id} className="p-5 sm:p-6 hover:bg-slate-50 transition-colors">
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col items-start pr-4">
                          
                          <p className="font-bold text-slate-900 text-sm flex items-center flex-wrap gap-1.5">
                            <span className="text-slate-400 font-normal">From</span> 
                            <span 
                              onClick={() => navigate(`/user/${review.reviewerId}`)}
                              className="cursor-pointer hover:text-violet-600 hover:underline transition-colors"
                            >
                              {review.reviewerName || "Anonymous"}
                            </span>
                            
                            {review.revieweeRole && (
                              <Badge 
                                className={`ml-1 text-[8px] uppercase tracking-widest font-black px-1.5 py-0 h-4 shadow-none ${
                                  review.revieweeRole === 'donor' 
                                    ? 'bg-violet-100 text-violet-700 hover:bg-violet-100' 
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                }`}
                              >
                                As {review.revieweeRole}
                              </Badge>
                            )}
                          </p>

                          {/* 🌟 MODIFIED: Changed from <button> to <div> to remove clickability for privacy */}
                          <div className="flex items-center gap-1.5 mt-1.5 text-left">
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] uppercase font-black px-1.5 py-0 border leading-tight ${
                                review.flowType === 'request' 
                                  ? 'text-blue-600 bg-blue-50 border-blue-200' 
                                  : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                              }`}
                            >
                              {review.flowType === 'request' ? 'Request' : 'Donation'}
                            </Badge>
                            
                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider line-clamp-1">
                              {review.transactionTitle || review.donationTitle || "Food Item"}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end shrink-0 pt-0.5 gap-1.5">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                            ))}
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                            {formatReviewDate(review.createdAt)}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm italic p-3.5 rounded-xl leading-relaxed mt-2 text-slate-600 bg-slate-50 border border-slate-100">
                        "{review.comment || "No comment provided."}"
                      </p>

                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
        </div>
      </div>
    </div>
  );
}