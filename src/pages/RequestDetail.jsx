import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { doc, onSnapshot, query, collection, where, updateDoc, serverTimestamp } from "firebase/firestore"; 
import { db } from "@/services/firebase/config"; 
import { 
  acceptRequest, 
  markAsCollected, 
  markAsCompleted,
  releaseFulfillment,
  cancelRequest,
  adminRemoveRequest,
  completeRequestViaQR,
  expireRequest 
} from "@/features/requests/requestService";
import { useAuth } from "@/features/auth/useAuth";
import { getUserProfile } from "@/features/users/userService"; 
import { calculateDistance } from "@/utils/distance"; 

import { useLocationContext } from "@/features/location/LocationContext";

import ReviewModal from "@/features/reviews/ReviewModal";
import ReportModal from "@/features/reports/ReportModal";
import { checkIfReviewed } from "@/features/reviews/reviewService";

import { QRCodeSVG } from "qrcode.react";
import { Scanner } from "@yudiel/react-qr-scanner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Loader2,
  PackageCheck,
  XCircle,
  AlertOctagon,
  Navigation,
  Map, 
  MessageCircle,
  HeartHandshake,
  ShoppingBag,
  Users,
  Star,
  MessageSquare,
  Trash2,
  QrCode,    
  ScanLine,
  EyeOff,   
  Eye,      
  ShieldAlert, 
  ArrowRight,
  Ban
} from "lucide-react";

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

const getSafeDate = (val) => {
  if (!val) return new Date();
  return val.toMillis ? new Date(val.toMillis()) : new Date(val);
};

const formatWhatsAppNumber = (phone) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, ''); 
  return cleaned.startsWith('0') ? `6${cleaned}` : cleaned; 
};

const getPartialAddress = (address) => {
  if (!address) return "Location not provided";
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 4) {
    return parts.slice(-4).join(', ');
  }
  return address; 
};

export default function RequestDetail() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth(); 
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const { anchorLocation } = useLocationContext();

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState(null); 
  const [hasReviewed, setHasReviewed] = useState(false);
  const [requestReviews, setRequestReviews] = useState([]); 

  const [postReports, setPostReports] = useState([]);
  const [reportModalConfig, setReportModalConfig] = useState({ isOpen: false, reportId: null, status: null });
  const [adminNote, setAdminNote] = useState("");

  const [showQRModal, setShowQRModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, "requests", id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRequest({ id: docSnap.id, ...data });
      } else {
        navigate("/requests");
      }
      setLoading(false);
    }, (error) => {
      console.error("Listener Error:", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [id, navigate]);

  useEffect(() => {
    let unsubscribeReviews;
    let unsubscribeReports; 

    const checkAndListen = async () => {
      if (user && id && request?.status === "completed") {
        const reviewed = await checkIfReviewed(id, user.uid, "request");
        setHasReviewed(reviewed);

        const q = query(collection(db, "reviews"), where("requestId", "==", id));
        
        unsubscribeReviews = onSnapshot(q, (snapshot) => {
          const reviews = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          }));
          setRequestReviews(reviews); 
        });
      }

      if (isAdmin && id) {
        const rQ = query(collection(db, "reports"), where("requestId", "==", id));
        unsubscribeReports = onSnapshot(rQ, (snap) => {
          setPostReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }
    };

    checkAndListen();

    return () => {
      if (unsubscribeReviews) unsubscribeReviews();
      if (unsubscribeReports) unsubscribeReports();
    };
  }, [user, id, request?.status, isAdmin]); 

  const handleUpdateStatus = async (nextStatus) => {
    const messages = {
      fulfilled: "Do you want to fulfill this request? Please ensure you can provide the food before the needed time.",
      collected: "Confirm that you have physically received this food?",
      completed: "Mark this request as fully completed? This confirms the handover happened.",
      open: "Are you sure you want to cancel your commitment? The request will become open to others again."
    };

    if (!window.confirm(messages[nextStatus])) return;
    
    setUpdating(true);
    try {
      if (nextStatus === "fulfilled") {
        const profile = await getUserProfile(user.uid);
        await acceptRequest(
          id, 
          user.uid, 
          profile?.fullName || user.displayName || "Generous Donor", 
          profile?.phone || "No phone provided"
        );
      } else if (nextStatus === "collected") {
        await markAsCollected(id, user.uid);
      } else if (nextStatus === "completed") {
        await markAsCompleted(id, user.uid);
      } else if (nextStatus === "open") {
        await releaseFulfillment(id);
      }
    } catch (error) {
      alert(error.message || "Update failed. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelPost = async () => {
    if (!window.confirm("Are you sure you want to cancel this request? It will be removed from the public feed.")) return;
    
    setUpdating(true);
    try {
      await cancelRequest(id);
    } catch (error) {
      alert("Failed to cancel request. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAdminDelete = async () => {
    if (!window.confirm("ADMIN ACTION: Are you sure you want to permanently remove this request from the platform?")) return;

    setUpdating(true);
    try {
      await adminRemoveRequest(id); 
      alert("Request removed successfully.");
      navigate("/requests"); 
    } catch (error) {
      console.error("Failed to remove request:", error);
      alert("Error removing request. Check your permissions.");
      setUpdating(false);
    }
  };

  const handleAdminForceStatus = async (newStatus) => {
    if (!window.confirm(`ADMIN: Force update request status to ${newStatus.toUpperCase()}?`)) return;
    setUpdating(true);
    try {
      if (newStatus === "open") {
        await releaseFulfillment(id);
      } else if (newStatus === "cancelled") {
        await cancelRequest(id);
      } else if (newStatus === "expired") {
        await expireRequest(id); 
      } else if (newStatus === "completed") {
        await updateDoc(doc(db, "requests", id), {
          status: "completed",
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error(error);
      alert("Failed to force update status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleReviewVisibility = async (reviewId, isCurrentlyHidden) => {
    const action = isCurrentlyHidden ? "Restore" : "Hide (Soft Delete)";
    if (!window.confirm(`ADMIN: ${action} this review?`)) return;
    try {
      await updateDoc(doc(db, "reviews", reviewId), { isHidden: !isCurrentlyHidden });
    } catch (error) {
      alert("Error updating review visibility.");
    }
  };

  const handleOpenReportModal = (reportId, status) => {
    setReportModalConfig({ isOpen: true, reportId, status });
    setAdminNote(""); 
  };

  const confirmReportAction = async () => {
    const { reportId, status } = reportModalConfig;
    if (!reportId || !status) return;
    
    setUpdating(true);
    try {
      const updatePayload = { reportStatus: status };
      if (adminNote.trim() !== "") {
        updatePayload.adminComment = adminNote.trim();
      }
      await updateDoc(doc(db, "reports", reportId), updatePayload);
      
      setReportModalConfig({ isOpen: false, reportId: null, status: null });
      setAdminNote("");
    } catch (e) {
      alert("Error updating report status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleQRScan = async (result) => {
    if (!result) return;
    
    const scannedText = Array.isArray(result) ? result[0]?.rawValue : result;
    
    if (scannedText !== id) {
      alert("Invalid QR Code! This code does not match the current food request.");
      return;
    }

    if (user.uid !== request.requesterId) {
      alert("Security Alert: You are not the authorized requester for this food.");
      setShowScannerModal(false);
      return;
    }

    if (user.uid === request.donorId) {
      alert("Security Alert: The fulfiller cannot scan their own QR code.");
      setShowScannerModal(false);
      return;
    }

    if (request.status !== "fulfilled") {
      alert("This request is no longer actively fulfilled and cannot be collected.");
      setShowScannerModal(false);
      return;
    }

    setShowScannerModal(false);
    setUpdating(true);
    try {
      await completeRequestViaQR(id, user.uid);
    } catch (error) {
      alert(error.message || "QR Update failed. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !request) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );

  if (request.status === "removed") {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500 space-y-4">
        <AlertOctagon className="w-12 h-12 text-red-500" />
        <h2 className="text-2xl font-bold text-slate-900">Request Removed</h2>
        <p>This content was removed by an admin for violating community guidelines.</p>
        <Button onClick={() => navigate("/requests")} variant="outline" className="mt-4">
          Return to Feed
        </Button>
      </div>
    );
  }

  const expiryDate = getSafeDate(request.expiryDateTime).toLocaleString("en-MY", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const isOwner = user?.uid === request.requesterId; 
  const isFulfiller = user?.uid === request.donorId; 

  const expiryObj = getSafeDate(request.expiryDateTime);
  const isPastTime = new Date() > expiryObj;
  const isExpiredState = request.status === "expired";
  const hoursLeft = (expiryObj - new Date()) / (1000 * 60 * 60);

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
  if (anchorLocation?.lat && anchorLocation?.lon && request.latitude && request.longitude) {
    const dist = calculateDistance(anchorLocation.lat, anchorLocation.lon, request.latitude, request.longitude);
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

  const displayReviews = isAdmin ? requestReviews : requestReviews.filter(r => !r.isHidden);

  return (
    <div className="mx-auto max-w-screen-xl pb-24 relative min-h-screen bg-slate-50 md:bg-transparent md:pt-6">
      
      {reportModalConfig.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className={`p-5 border-b ${reportModalConfig.status === 'resolved' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                {reportModalConfig.status === 'resolved' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Ban className="w-5 h-5 text-slate-600" />}
                Confirm Action
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                You are about to mark this report as <strong className="uppercase">{reportModalConfig.status}</strong>.
              </p>
            </div>
            <div className="p-5 space-y-3 flex-1 bg-white">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Optional Moderator Note
              </label>
              <textarea 
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Explain why this action was taken (visible to admins)..."
                className="w-full min-h-[100px] p-3 text-sm rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none resize-none transition-all"
              />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button 
                variant="ghost" 
                onClick={() => setReportModalConfig({ isOpen: false, reportId: null, status: null })}
                className="rounded-xl font-bold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmReportAction}
                className={`rounded-xl font-bold text-white ${reportModalConfig.status === 'resolved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                Confirm & Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 flex items-center justify-between bg-white/80 md:bg-transparent px-4 py-3 backdrop-blur-md border-b md:border-none md:mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-white md:shadow-sm md:border md:border-slate-200 hover:bg-slate-100 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-bold text-slate-900 md:hidden">Request Details</span>
        <div className="w-10" /> 
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-start gap-0 lg:gap-8 md:px-8">
        
        <div className="lg:col-span-7 flex flex-col gap-6 md:gap-8">
          
          <div className="relative h-80 md:h-[500px] w-full bg-slate-200 md:rounded-[2rem] overflow-hidden md:border md:border-slate-200 shadow-sm">
            {request.imageURLs?.length > 0 ? (
              <>
                <img 
                  src={request.imageURLs[currentImgIndex]} 
                  className={`h-full w-full object-cover shadow-inner ${isExpiredState ? 'grayscale opacity-80' : ''}`} 
                  alt="Food Needed" 
                />
                {request.imageURLs.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-between px-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full bg-black/20 text-white backdrop-blur-sm hover:bg-black/40"
                      onClick={() => setCurrentImgIndex(prev => prev === 0 ? request.imageURLs.length - 1 : prev - 1)}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full bg-black/20 text-white backdrop-blur-sm hover:bg-black/40"
                      onClick={() => setCurrentImgIndex(prev => prev === request.imageURLs.length - 1 ? 0 : prev + 1)}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </div>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {request.imageURLs.map((_, i) => (
                    <div key={i} className={`h-1.5 w-1.5 rounded-full transition-all ${i === currentImgIndex ? "bg-white w-4" : "bg-white/50"}`} />
                  ))}
                </div>
              </>
            ) : (
              <div className="relative w-full h-full bg-gradient-to-br from-violet-50 to-violet-100/80 flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-violet-200/50 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-32 h-32 bg-blue-200/40 rounded-full blur-2xl"></div>

                <div className="w-20 h-20 md:w-24 md:h-24 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-white z-10">
                  <ShoppingBag className="w-10 h-10 md:w-12 md:h-12 text-violet-500 stroke-[2]" />
                </div>
                <span className="mt-4 text-xs md:text-sm font-black text-violet-600/80 uppercase tracking-widest z-10">
                  Food Request
                </span>
              </div>
            )}
          </div>

          <div className="lg:hidden px-5 space-y-6">
            <TitleAndInfo 
              request={request} 
              urgency={urgency} 
              isPastTime={isPastTime} 
              expiryDate={expiryDate} 
              distanceText={distanceText} 
              isOwner={isOwner} 
              isFulfiller={isFulfiller} 
              isAdmin={isAdmin}
              setShowReportModal={setShowReportModal}
              setReportTargetId={setReportTargetId}
              navigate={navigate} 
            />
          </div>

          <div className="px-5 md:px-0 space-y-2">
            <h3 className="text-lg md:text-xl font-bold text-slate-900">Description</h3>
            <p className="text-slate-600 md:text-lg leading-relaxed bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 md:shadow-sm">
              {request.description || "No specific description provided."}
            </p>
          </div>

          <div className="px-5 md:px-0">
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 md:shadow-sm space-y-4">
              <h3 className="text-lg md:text-xl font-extrabold text-slate-900 mb-2">Request Journey</h3>
              <div className="pt-2 pl-2">
                {renderTimelineStep("Posted", request.createdAt, true, request.status === "open")}
                
                {request.status === "cancelled" ? (
                  renderTimelineStep("Cancelled", request.cancelledAt || request.updatedAt, true, true)
                ) : request.status === "expired" ? (
                  renderTimelineStep("Expired", request.expiredAt || request.updatedAt, true, true)
                ) : (
                  <>
                    {renderTimelineStep(
                      "Fulfilled", 
                      request.acceptedAt, 
                      ["fulfilled", "collected", "completed"].includes(request.status),
                      request.status === "fulfilled"
                    )}
                    {renderTimelineStep(
                      "Received", 
                      request.collectedAt, 
                      ["collected", "completed"].includes(request.status),
                      request.status === "collected"
                    )}
                    {renderTimelineStep(
                      "Completed", 
                      request.completedAt, 
                      request.status === "completed", 
                      true 
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {request.status === "completed" && displayReviews.length > 0 && (
            <div className="px-5 md:px-0 space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-lg md:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-violet-600" />
                Handover Feedback
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayReviews.map((rev) => (
                  <Card key={rev.id} className={`rounded-3xl border-slate-100 shadow-sm overflow-hidden ${rev.isHidden ? 'bg-slate-100 opacity-70' : 'bg-white'}`}>
                    <CardContent className="p-5">
                      
                      <div className="flex flex-col gap-2 mb-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full w-fit ${
                              rev.reviewerRole === 'donor' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {rev.reviewerRole}'s perspective
                            </span>
                            {rev.isHidden && (
                              <Badge variant="secondary" className="text-[9px] bg-slate-200 text-slate-500 py-0"><EyeOff className="w-3 h-3 mr-1"/> Hidden</Badge>
                            )}
                          </div>
                          {isAdmin && (
                            <button 
                              onClick={() => handleToggleReviewVisibility(rev.id, rev.isHidden)}
                              className={`p-1.5 rounded-lg transition-colors shrink-0 ${rev.isHidden ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                              title={rev.isHidden ? "Restore Review" : "Hide Review"}
                            >
                              {rev.isHidden ? <Eye className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>

                        <div className="flex justify-between items-center gap-2">
                           <p className="font-bold text-slate-900 text-sm truncate">{rev.reviewerName}</p>
                           <div className="flex gap-0.5 bg-amber-50 rounded-full px-1.5 py-1 shrink-0">
                             {[...Array(5)].map((_, i) => (
                               <Star key={i} className={`w-3.5 h-3.5 shrink-0 ${i < rev.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                             ))}
                           </div>
                        </div>
                      </div>
                      
                      <p className={`text-sm italic p-3 rounded-2xl ${rev.isHidden ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-600'}`}>
                        "{rev.comment || "No comment left."}"
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="lg:hidden px-5 pb-6">
            <ActionButtons 
              request={request} 
              isOwner={isOwner} 
              isFulfiller={isFulfiller} 
              updating={updating} 
              handleUpdateStatus={handleUpdateStatus} 
              handleCancelPost={handleCancelPost} 
              navigate={navigate} 
              id={id} 
              isAdmin={isAdmin}
              handleAdminDelete={handleAdminDelete} 
              hasReviewed={hasReviewed}
              setShowReviewModal={setShowReviewModal}
              setShowQRModal={setShowQRModal}
              setShowScannerModal={setShowScannerModal}
              postReports={postReports}
              handleAdminForceStatus={handleAdminForceStatus} 
              handleOpenReportModal={handleOpenReportModal}
            />
          </div>

        </div>

        <div className="hidden lg:flex lg:col-span-5 flex-col space-y-6 sticky top-24 h-fit pb-8">
          <TitleAndInfo 
            request={request} 
            urgency={urgency} 
            isPastTime={isPastTime} 
            expiryDate={expiryDate} 
            distanceText={distanceText} 
            isOwner={isOwner} 
            isFulfiller={isFulfiller} 
            isAdmin={isAdmin}
            setShowReportModal={setShowReportModal}
            setReportTargetId={setReportTargetId}
            navigate={navigate} 
          />
          <ActionButtons 
            request={request} 
            isOwner={isOwner} 
            isFulfiller={isFulfiller} 
            updating={updating} 
            handleUpdateStatus={handleUpdateStatus} 
            handleCancelPost={handleCancelPost} 
            navigate={navigate} 
            id={id} 
            isAdmin={isAdmin}
            handleAdminDelete={handleAdminDelete}
            hasReviewed={hasReviewed}
            setShowReviewModal={setShowReviewModal}
            setShowQRModal={setShowQRModal}
            setShowScannerModal={setShowScannerModal}
            postReports={postReports}
            handleAdminForceStatus={handleAdminForceStatus} 
            handleOpenReportModal={handleOpenReportModal}
          />
        </div>

      </div>

      <ReviewModal 
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        data={request}
        currentUser={user}
        onSuccess={() => setHasReviewed(true)}
      />

      <ReportModal 
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportTargetId(null); 
        }}
        request={request}
        currentUser={user}
        reportedUserId={reportTargetId} 
      />

      {/* --- NEW: QR CODE MODAL FOR FULFILLER (DONOR) --- */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full flex flex-col items-center animate-in fade-in zoom-in duration-200 shadow-2xl relative">
             <Button 
               variant="ghost" 
               size="icon" 
               className="absolute top-4 right-4 rounded-full bg-slate-100 hover:bg-slate-200" 
               onClick={() => setShowQRModal(false)}
             >
               <XCircle className="w-5 h-5 text-slate-500" />
             </Button>
             
             <div className="bg-violet-100 p-3 rounded-2xl text-violet-600 mb-4">
               <QrCode className="w-8 h-8" />
             </div>
             
             <h3 className="text-xl font-bold text-slate-900 mb-2">Handover QR Code</h3>
             <p className="text-sm text-slate-500 text-center mb-8">
               Ask the requester to open this page and tap <span className="font-bold text-slate-700">"Scan Handover QR"</span>.
             </p>
             
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-2">
               <QRCodeSVG value={id} size={200} />
             </div>
          </div>
        </div>
      )}

      {/* --- NEW: QR SCANNER MODAL FOR REQUESTER (OWNER) --- */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full flex flex-col items-center animate-in fade-in zoom-in duration-200 shadow-2xl relative">
             <Button 
               variant="ghost" 
               size="icon" 
               className="absolute top-4 right-4 rounded-full bg-slate-100 hover:bg-slate-200 z-10" 
               onClick={() => setShowScannerModal(false)}
             >
               <XCircle className="w-5 h-5 text-slate-500" />
             </Button>
             
             <h3 className="text-xl font-bold text-slate-900 mb-2 mt-2">Scan Handover QR</h3>
             <p className="text-sm text-slate-500 text-center mb-6">
               Point your camera at the fulfiller's screen to instantly confirm you received the food.
             </p>
             
             <div className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 mb-2 border-4 border-slate-100 relative">
               <Scanner 
                 onScan={(result) => handleQRScan(result)} 
                 onError={(error) => console.log("Scanner Error:", error)} 
               />
               <div className="absolute inset-0 pointer-events-none border-[40px] border-black/30"></div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

// 🌟 MODIFIED: Added navigate to props
function TitleAndInfo({ request, urgency, isPastTime, expiryDate, distanceText, isOwner, isFulfiller, isAdmin, setShowReportModal, setReportTargetId, navigate }) {
  
  const canSeeFullAddress = isOwner || isFulfiller || isAdmin;
  const displayAddress = canSeeFullAddress ? request.address : getPartialAddress(request.address);

  return (
    <>
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">{request.foodName}</h1>
          <Badge className={`
            border-none px-3 py-1 text-sm md:text-base font-bold rounded-full md:shadow-sm shrink-0
            ${request.status === 'open' ? 'bg-emerald-100 text-emerald-700' : ''}
            ${request.status === 'fulfilled' ? 'bg-amber-100 text-amber-700' : ''}
            ${request.status === 'collected' ? 'bg-blue-100 text-blue-700' : ''}
            ${request.status === 'completed' ? 'bg-slate-200 text-slate-700' : ''}
            ${request.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
            ${request.status === 'expired' ? 'bg-slate-700 text-white' : ''}
          `}>
            {request.status.toUpperCase()}
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-violet-700 border-violet-200 bg-violet-50 text-xs md:text-sm">{request.foodType}</Badge>
          <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-xs md:text-sm font-bold">Qty: {request.quantity} {request.quantityUnit}</Badge>
          
          {request.foodTags?.filter(tag => tag !== request.foodType).map(tag => {
            const isRequestType = tag === "Personal" || tag === "Community Aid";
            return (
              <Badge 
                key={tag} 
                variant="secondary" 
                className={
                  isRequestType 
                    ? "bg-violet-100 text-violet-800 text-[10px] md:text-sm font-bold border border-violet-200 flex items-center" 
                    : "bg-slate-100 text-slate-600 text-xs md:text-sm font-normal"
                }
              >
                {tag === "Personal" && <User className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" />}
                {tag === "Community Aid" && <Users className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" />}
                {tag}
              </Badge>
            );
          })}
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
                  {isPastTime ? "Expired" : "Needed By"}
                </p>
                <div className="flex flex-col">
                  <p className={`text-base md:text-lg font-bold md:font-black ${urgency.textColor}`}>
                    {isPastTime ? "Time has passed" : formatTimeLeft(request.expiryDateTime)}
                  </p>
                  <p className="text-xs md:text-sm text-slate-400 md:text-slate-500 font-medium">{expiryDate}</p>
                </div>
              </div>
            </div>
            
            <div className="md:border-t md:border-slate-100"></div>

            <div className="flex items-start gap-3 md:gap-4">
              <div className="rounded-full md:rounded-2xl bg-violet-50 p-2 md:p-3 text-violet-600 shrink-0 md:shadow-inner">
                <MapPin className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                  <p className="text-xs font-semibold md:font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-widest">Drop-off Location</p>
                  {distanceText && (
                    <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px] border-violet-200 bg-violet-50 text-violet-600 font-bold rounded-sm">
                      <Navigation className="w-2.5 h-2.5 mr-1" /> {distanceText}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm md:text-base font-medium md:font-semibold text-slate-700 leading-relaxed pr-2">
                    {displayAddress}
                    {!canSeeFullAddress && (
                      <span className="block text-[9px] text-slate-400 mt-1 uppercase font-semibold tracking-wider">
                        Exact location revealed upon fulfillment
                      </span>
                    )}
                  </p>
                  
                  {canSeeFullAddress && (
                    <a 
                      href={`https://maps.google.com/?q=${request.latitude},${request.longitude}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-xl text-[11px] font-bold transition-colors shadow-sm"
                    >
                      <Map className="w-3.5 h-3.5" /> Map
                    </a>
                  )}
                </div>

              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl md:rounded-3xl border-slate-100 shadow-sm md:overflow-hidden">
          <CardContent className="p-4 md:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="rounded-full md:rounded-2xl bg-violet-50 p-2 md:p-3 text-violet-600 md:shadow-inner">
                  <User className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold md:font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-widest mb-0.5">Requester</p>
                  
                  {/* 🌟 MODIFIED: Clickable Requester Name */}
                  <p 
                    className="text-sm md:text-base font-bold text-slate-900 cursor-pointer hover:text-violet-600 hover:underline transition-colors w-fit"
                    onClick={() => navigate(isAdmin ? `/admin/users/${request.requesterId}` : `/user/${request.requesterId}`)}
                  >
                    {request.requesterName}
                  </p>

                </div>
              </div>

              {!isOwner && (
                <button 
                  onClick={() => {
                    setReportTargetId(request.requesterId); 
                    setShowReportModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors uppercase tracking-widest border border-transparent hover:border-red-100"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                  Report
                </button>
              )}
            </div>
            
            { (isOwner || isAdmin || (isFulfiller && request.status !== "open" && request.status !== "cancelled" && request.status !== "expired")) && (
               <div className="flex items-center gap-3 md:gap-4 pt-4 border-t border-slate-50 md:border-slate-100">
                  <div className="rounded-full md:rounded-2xl bg-emerald-50 p-2 md:p-3 text-emerald-600 md:shadow-inner">
                    <Phone className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold md:font-bold text-slate-500 md:text-slate-400 uppercase md:tracking-widest mb-0.5">Requester Contact</p>
                    
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm md:text-base font-bold text-slate-900">{request.contactNumber || "Not provided"}</p>
                      {request.contactNumber && (
                        <div className="flex gap-2 shrink-0">
                          <a 
                            href={`https://wa.me/${formatWhatsAppNumber(request.contactNumber)}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors shadow-sm"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Chat
                          </a>
                          <a 
                            href={`tel:${request.contactNumber}`} 
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

        {(isOwner || isAdmin) && ["fulfilled", "collected", "completed"].includes(request.status) && request.donorName && (
          <Card className="rounded-2xl md:rounded-3xl border-violet-100 bg-violet-50/50 shadow-none animate-in fade-in zoom-in duration-300">
            <CardContent className="p-4 md:p-5 space-y-3 md:space-y-4">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-violet-600" />
                  <span className="text-xs font-bold md:font-black text-violet-800 uppercase tracking-wider md:tracking-widest">Donor Found</span>
                </div>
                
                <button 
                  onClick={() => {
                    setReportTargetId(request.donorId); // Targets Fulfiller
                    setShowReportModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors uppercase tracking-widest border border-transparent hover:border-red-100"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-red-500" /> Report
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-violet-100/60">
                <div>
                  {/* 🌟 MODIFIED: Clickable Donor/Fulfiller Name */}
                  <p 
                    className="text-sm md:text-base font-bold text-slate-900 cursor-pointer hover:text-violet-600 hover:underline transition-colors w-fit"
                    onClick={() => navigate(isAdmin ? `/admin/users/${request.donorId}` : `/user/${request.donorId}`)}
                  >
                    {request.donorName}
                  </p>

                  <p className="text-xs md:text-sm text-slate-500 md:font-medium">{request.donorPhone}</p>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-white shadow-sm text-[11px] font-black uppercase" asChild>
                    <a href={`https://wa.me/${formatWhatsAppNumber(request.donorPhone)}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="w-4 h-4 mr-1.5" />
                      Chat
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl border-violet-200 text-violet-600 md:text-violet-700 bg-white md:hover:bg-violet-100 shadow-sm" asChild>
                    <a href={`tel:${request.donorPhone}`}>
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

// 🌟 MODIFIED: Added Admin panel and logic mirroring donations
function ActionButtons({ 
  request, isOwner, isFulfiller, updating, handleUpdateStatus, handleCancelPost, navigate, id, 
  isAdmin, handleAdminDelete, hasReviewed, setShowReviewModal, setShowQRModal, setShowScannerModal,
  postReports, handleAdminForceStatus, handleOpenReportModal
}) {
  return (
    <>
      {isOwner && request.status === "open" && (
        <div className="flex gap-3 pt-2 animate-in fade-in slide-in-from-bottom-4">
          <Button 
            variant="outline" 
            className="flex-1 rounded-2xl border-slate-200 text-slate-700 font-bold h-12 hover:bg-slate-50 shadow-sm"
            onClick={() => navigate(`/requests/edit/${id}`)}
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

      {request.status !== "cancelled" && (
        <div className="pt-2 md:pt-0 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-lg md:text-xl font-extrabold text-slate-900">Update Status</h3>
            
            {request.status === "expired" && (
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2">
                 <AlertOctagon className="w-6 h-6 text-slate-400" />
                 <p className="text-slate-600 text-sm font-bold">This request has expired.</p>
               </div>
            )}

            {request.status === "open" && (
              <Button 
                className="w-full h-14 rounded-2xl bg-violet-600 text-white text-lg font-bold shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all active:scale-95"
                disabled={isOwner || updating}
                onClick={() => handleUpdateStatus("fulfilled")}
              >
                {updating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <HeartHandshake className="w-6 h-6 mr-2" />}
                {isOwner ? "Waiting for a donor..." : "Fulfill This Request"}
              </Button>
            )}

            {/* 🌟 FIX: Separated into 3 distinct checks for privacy & security */}
            {request.status === "fulfilled" && (
              <>
                {isOwner && (
                  <div className="flex flex-col gap-3">
                    <Button 
                      className="w-full h-14 rounded-2xl bg-blue-600 text-white text-lg font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                      disabled={updating}
                      onClick={() => setShowScannerModal(true)}
                    >
                      <ScanLine className="w-6 h-6 mr-2" />
                      Scan Handover QR
                    </Button>

                    <div className="relative flex items-center py-2">
                       <div className="flex-grow border-t border-slate-200"></div>
                       <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-black uppercase tracking-widest">OR</span>
                       <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <Button 
                      variant="outline"
                      className="w-full h-14 rounded-2xl border-blue-200 text-blue-700 text-lg font-bold hover:bg-blue-50 transition-all active:scale-95"
                      disabled={updating}
                      onClick={() => handleUpdateStatus("collected")}
                    >
                      {updating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <PackageCheck className="w-6 h-6 mr-2" />}
                      Manual: I've Received
                    </Button>
                  </div>
                )}

                {isFulfiller && (
                  <div className="flex flex-col gap-3">
                    <Button 
                      className="w-full h-14 rounded-2xl bg-violet-600 text-white text-lg font-bold shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all active:scale-95"
                      disabled={updating}
                      onClick={() => setShowQRModal(true)}
                    >
                      <QrCode className="w-6 h-6 mr-2" />
                      Show Handover QR
                    </Button>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center mt-2">
                      <p className="text-amber-700 text-sm font-bold">
                        Food Fulfilled by You (Waiting for Requester)
                      </p>
                    </div>
                  </div>
                )}

                {!isOwner && !isFulfiller && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center mt-2">
                    <p className="text-amber-700 text-sm font-bold">
                      Request Fulfilled by Another User
                    </p>
                  </div>
                )}
              </>
            )}

            {request.status === "collected" && (
              isFulfiller ? (
                <Button 
                  className="w-full h-14 rounded-2xl bg-emerald-600 text-white text-lg font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                  disabled={updating}
                  onClick={() => handleUpdateStatus("completed")}
                >
                  {updating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <CheckCircle2 className="w-6 h-6 mr-2" />}
                  Confirm Handover Finished
                </Button>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-emerald-700 text-sm font-bold">Waiting for Donor to Finalize</p>
                </div>
              )
            )}

            {request.status === "completed" && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-100 rounded-2xl text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-slate-400" />
                  <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Handover Completed</p>
                </div>

                {(isOwner || isFulfiller) && (
                  !hasReviewed ? (
                    <Button 
                      onClick={() => setShowReviewModal(true)}
                      className="w-full h-12 rounded-2xl bg-white border-2 border-violet-600 text-violet-600 font-bold hover:bg-violet-50 transition-all active:scale-95 shadow-sm"
                    >
                      <Star className="w-4 h-4 mr-2" /> Rate Your Experience
                    </Button>
                  ) : (
                    <p className="text-center text-xs text-emerald-600 font-bold italic animate-in fade-in">
                      ✓ You have submitted a review
                    </p>
                  )
                )}
              </div>
            )}

            {request.status === "fulfilled" && (isOwner || isFulfiller) && (
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 font-bold transition-all mt-4"
                onClick={() => handleUpdateStatus("open")}
                disabled={updating}
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Cancel Commitment
              </Button>
            )}

            {isAdmin && (
              <div className="mt-8 pt-6 border-t border-red-100 animate-in fade-in slide-in-from-bottom-4 space-y-4">
                <p className="text-xs font-black text-red-500 uppercase tracking-widest text-center md:text-left flex items-center justify-center md:justify-start gap-2">
                  <ShieldAlert className="w-4 h-4" /> Admin Controls
                </p>

                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-3">
                   <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider text-center md:text-left">Force Status Update</p>
                   <div className="grid grid-cols-2 gap-2">
                     <Button size="sm" variant="outline" onClick={() => handleAdminForceStatus('open')} className="text-xs rounded-xl border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 font-bold">Force Open</Button>
                     <Button size="sm" variant="outline" onClick={() => handleAdminForceStatus('completed')} className="text-xs rounded-xl border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 font-bold">Force Complete</Button>
                     <Button size="sm" variant="outline" onClick={() => handleAdminForceStatus('cancelled')} className="text-xs rounded-xl border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 font-bold">Force Cancel</Button>
                     <Button size="sm" variant="outline" onClick={() => handleAdminForceStatus('expired')} className="text-xs rounded-xl border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 font-bold">Force Expire</Button>
                   </div>
                </div>

                {postReports?.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-3 max-h-[400px] overflow-y-auto">
                    <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider text-center md:text-left">Post Reports ({postReports.length})</p>
                    {postReports.map(report => (
                      <div key={report.id} className="bg-white p-3 rounded-xl shadow-sm text-sm border border-red-100 flex flex-col gap-2">
                         <div className="flex justify-between items-start">
                           <span className="font-bold text-slate-800 text-xs">{report.issueType}</span>
                           <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider border-none ${report.reportStatus === 'pending' || !report.reportStatus ? 'text-orange-600 bg-orange-50' : report.reportStatus === 'resolved' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'}`}>
                             {report.reportStatus || 'pending'}
                           </Badge>
                         </div>
                         
                         <div className="flex items-center gap-1 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100 min-w-0">
                           <span 
                             className="text-xs font-bold text-slate-900 truncate shrink cursor-pointer hover:text-violet-600 hover:underline transition-colors"
                             onClick={() => navigate(`/admin/users/${report.reporterId}`)}
                           >
                             {report.reporterName || "User"}
                           </span>
                           <span className="text-[9px] text-slate-400 font-medium shrink-0">({report.reporterId === request.requesterId ? "Requester" : "Fulfiller"})</span>
                           
                           <ArrowRight className="w-3 h-3 text-slate-300 shrink-0 mx-0.5" />
                           
                           <span 
                             className="text-xs font-bold text-slate-900 truncate shrink cursor-pointer hover:text-violet-600 hover:underline transition-colors"
                             onClick={() => navigate(`/admin/users/${report.reportedUserId}`)}
                           >
                             {report.reportedUserName || "User"}
                           </span>
                           <span className="text-[9px] text-slate-400 font-medium shrink-0">({report.reportedUserId === request.requesterId ? "Requester" : "Fulfiller"})</span>
                         </div>

                         <p className="text-xs text-slate-600 italic leading-relaxed mt-1">"{report.description}"</p>
                         
                         {report.adminComment && (
                           <div className="mt-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-1 h-full bg-slate-800 rounded-l-xl"></div>
                             <div className="flex items-start gap-2">
                               <div className="p-1 bg-slate-200 rounded-lg text-slate-600 shrink-0">
                                 <MessageSquare className="w-3 h-3" />
                               </div>
                               <div>
                                 <span className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-0.5 block">
                                   Moderator Note
                                 </span>
                                 <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                   "{report.adminComment}"
                                 </p>
                               </div>
                             </div>
                           </div>
                         )}

                         {(!report.reportStatus || report.reportStatus === 'pending') && (
                           <div className="flex gap-2 mt-2">
                             <Button 
                               size="sm" 
                               variant="outline" 
                               className="h-7 rounded-lg text-[10px] font-bold flex-1 border-slate-200 text-slate-600 hover:bg-slate-50" 
                               onClick={() => handleOpenReportModal(report.id, 'dismissed')}
                             >
                               Dismiss
                             </Button>
                             <Button 
                               size="sm" 
                               variant="outline" 
                               className="h-7 rounded-lg text-[10px] font-bold flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50" 
                               onClick={() => handleOpenReportModal(report.id, 'resolved')}
                             >
                               Resolve
                             </Button>
                           </div>
                         )}
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  onClick={handleAdminDelete}
                  variant="outline"
                  disabled={updating}
                  className="w-full h-12 rounded-2xl bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 shadow-sm font-bold"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Remove Request from Platform
                </Button>
              </div>
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