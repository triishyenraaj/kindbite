import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, collection, query, where, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { updateUserProfile } from "@/features/users/userService"; 
import { useAuth } from "@/features/auth/useAuth"; 

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, Mail, Phone, MapPin, ShieldCheck, Ban, Star, 
  AlertOctagon, Loader2, MessageSquare, Flame, ShieldAlert, UserCheck, Trash2, EyeOff, Eye, CheckCircle2,
  ExternalLink 
} from "lucide-react";

// --- 🌟 HELPER: Format Date ---
const formatReviewDate = (timestamp) => {
  if (!timestamp) return "Just now";
  const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function AdminUserView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [targetUser, setTargetUser] = useState(null);
  const [reputation, setReputation] = useState({ average: 0, total: 0 });
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const [reportFilter, setReportFilter] = useState("pending");

  // 🌟 NEW: States for the Custom Admin Action Modal
  const [reportModalConfig, setReportModalConfig] = useState({ isOpen: false, reportId: null, status: null });
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const unsubUser = onSnapshot(doc(db, "users", id), (docSnap) => {
      if (docSnap.exists()) {
        setTargetUser({ id: docSnap.id, ...docSnap.data() });
      } else {
        setTargetUser(null);
      }
    });

    const qReviews = query(collection(db, "reviews"), where("revieweeId", "==", id));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const fetchedReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        
      setReviews(fetchedReviews);
      
      const visibleReviews = fetchedReviews.filter(r => !r.isHidden);
      if (visibleReviews.length > 0) {
        const totalScore = visibleReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
        setReputation({
          average: (totalScore / visibleReviews.length).toFixed(1),
          total: visibleReviews.length
        });
      } else {
        setReputation({ average: 0, total: 0 });
      }
    });

    const qReports = query(collection(db, "reports"), where("reportedUserId", "==", id));
    const unsubReports = onSnapshot(qReports, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubReviews();
      unsubReports();
    };
  }, [id]);

  const handleNavigation = (item) => {
    if (item.requestId) navigate(`/requests/${item.requestId}`);
    else if (item.donationId) navigate(`/donations/${item.donationId}`);
  };

  const handleToggleRole = async () => {
    const newRole = targetUser.role === "admin" ? "user" : "admin";
    if (!window.confirm(`Change this user's role to ${newRole.toUpperCase()}?`)) return;
    try {
      await updateUserProfile(id, { role: newRole });
    } catch (error) { alert("Failed to update user role."); }
  };

  const handleToggleStatus = async () => {
    const newStatus = targetUser.status === "suspended" ? "active" : "suspended";
    if (!window.confirm(`Are you sure you want to ${newStatus === "suspended" ? "SUSPEND" : "ACTIVATE"} this account?`)) return;
    try {
      await updateUserProfile(id, { status: newStatus });
    } catch (error) { alert("Failed to update user status."); }
  };

  const handleToggleReviewVisibility = async (reviewId, isCurrentlyHidden) => {
    const actionText = isCurrentlyHidden ? "Restore this review to public visibility?" : "Hide this review from the public platform? (Soft Delete)";
    if (!window.confirm(actionText)) return;
    try {
      await updateDoc(doc(db, "reviews", reviewId), { isHidden: !isCurrentlyHidden });
    } catch (error) { alert("Error updating review visibility."); }
  };

  // 🌟 MODIFIED: Opens the custom report modal
  const handleOpenReportModal = (reportId, status) => {
    setReportModalConfig({ isOpen: true, reportId, status });
    setAdminNote(""); 
  };

  // 🌟 MODIFIED: Processes the update from the modal
  const confirmReportAction = async () => {
    const { reportId, status } = reportModalConfig;
    if (!reportId || !status) return;
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
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-[60vh]">
        <AlertOctagon className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-500">User not found</h2>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const filteredReports = reports.filter(r => {
    const status = r.reportStatus || 'pending';
    return status === reportFilter;
  });

  const activeReportsCount = reports.filter(r => !r.reportStatus || r.reportStatus === 'pending').length;

  return (
    <div className="mx-auto max-w-6xl py-6 md:py-8 px-4 sm:px-6 space-y-6 animate-in fade-in slide-in-from-bottom-4">
      
      {/* 🌟 NEW: CUSTOM MODAL OVERLAY FOR ADMIN ACTION */}
      {reportModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
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

      {/* Top Header Navigation */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-slate-50 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-black text-slate-900 truncate">Admin Directory Overview</h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">ID: {id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* --- LEFT COLUMN: Identity & Core Stats --- */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-28">
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">
              <div className={`absolute top-0 inset-x-0 h-24 ${targetUser.status === 'suspended' ? 'bg-red-500' : targetUser.role === 'admin' ? 'bg-violet-600' : 'bg-slate-200'}`}></div>
              
              <Avatar className="w-28 h-28 border-4 border-white shadow-lg mt-6 mb-4 relative z-10">
                <AvatarImage src={targetUser.photoURL} className="object-cover" />
                <AvatarFallback className="text-3xl font-black bg-slate-100 text-slate-600">
                  {targetUser.fullName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              
              <h2 className="text-2xl font-black text-slate-900 break-words w-full px-2">{targetUser.fullName || "Unnamed User"}</h2>
              
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {targetUser.role === "admin" ? (
                  <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-none px-3 py-1"><ShieldCheck className="w-3 h-3 mr-1.5"/> Admin</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none px-3 py-1">Standard User</Badge>
                )}
                {targetUser.status === "suspended" && (
                  <Badge className="bg-red-50 text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1"><Ban className="w-3 h-3 mr-1.5"/> Suspended</Badge>
                )}
                <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 px-3 py-1"><Flame className="w-3 h-3 mr-1.5"/> {targetUser.kindPoints || 0} KP</Badge>
              </div>

              <div className="w-full mt-6 space-y-3 text-left border-t border-slate-100 pt-6">
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 min-w-0">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-700 truncate w-full">{targetUser.email}</span>
                </div>
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 min-w-0">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-700 truncate w-full">{targetUser.phone || "No phone provided"}</span>
                </div>
                <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-slate-700 leading-relaxed break-words">{targetUser.address || "No address on file"}</span>
                </div>
              </div>

              {currentUser?.uid !== id && (
                <div className="w-full mt-6 flex flex-col gap-3 pt-6 border-t border-slate-100">
                  <Button 
                    variant={targetUser.status === 'suspended' ? 'outline' : 'destructive'} 
                    className="w-full rounded-xl font-bold h-12 shadow-sm"
                    onClick={handleToggleStatus}
                  >
                    {targetUser.status === 'suspended' ? <><UserCheck className="w-4 h-4 mr-2"/> Lift Suspension</> : <><Ban className="w-4 h-4 mr-2"/> Suspend Account</>}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full rounded-xl font-bold h-12 text-slate-600 shadow-sm"
                    onClick={handleToggleRole}
                  >
                    <ShieldAlert className="w-4 h-4 mr-2"/> 
                    {targetUser.role === 'admin' ? "Revoke Admin Rights" : "Grant Admin Rights"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="rounded-3xl border-slate-200 bg-amber-50/50 shadow-sm border-amber-100/50 hover:bg-amber-50 transition-colors">
              <CardContent className="p-4 sm:p-6 text-center">
                <Star className="w-8 h-8 text-amber-500 fill-amber-500 mx-auto mb-2" />
                <h3 className="text-2xl sm:text-3xl font-black text-amber-700">{reputation.average > 0 ? reputation.average : "N/A"}</h3>
                <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest mt-1">Trust Score</p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-slate-200 bg-red-50/50 shadow-sm border-red-100/50 hover:bg-red-50 transition-colors">
              <CardContent className="p-4 sm:p-6 text-center">
                <AlertOctagon className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <h3 className="text-2xl sm:text-3xl font-black text-red-700">{activeReportsCount}</h3>
                <p className="text-[10px] font-black text-red-600/60 uppercase tracking-widest mt-1">Active Reports</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* --- RIGHT COLUMN: Activity Feed --- */}
        <div className="lg:col-span-8 space-y-6 w-full min-w-0">
          
          {/* Reports Section */}
          <Card className={`rounded-3xl shadow-sm overflow-hidden ${filteredReports.length > 0 && reportFilter === 'pending' ? 'border-red-200 bg-white' : 'border-slate-200 bg-white'}`}>
            <CardHeader className={`${filteredReports.length > 0 && reportFilter === 'pending' ? 'bg-red-50/50 border-b border-red-100' : 'bg-slate-50/50 border-b border-slate-100'} p-5 sm:p-6`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className={`text-base sm:text-lg font-black flex items-center gap-2 ${reportFilter === 'pending' ? 'text-red-700' : 'text-slate-700'}`}>
                  <AlertOctagon className="w-5 h-5" /> Reports Against User
                </CardTitle>
                
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
                  <button 
                    onClick={() => setReportFilter("pending")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportFilter === 'pending' ? 'bg-red-100 text-red-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >Pending</button>
                  <button 
                    onClick={() => setReportFilter("resolved")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportFilter === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >Resolved</button>
                  <button 
                    onClick={() => setReportFilter("dismissed")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportFilter === 'dismissed' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  >Dismissed</button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredReports.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold text-sm">
                  No {reportFilter} reports found for this user.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredReports.map(report => (
                    // 🌟 MODIFIED: Restructured layout to match the ModerationTab (Image 1 style)
                    <div key={report.id} className="p-6 flex flex-col md:flex-row gap-6 justify-between bg-white hover:bg-slate-50/50 transition-colors">
                      
                      {/* LEFT COLUMN: Info + Description + Images */}
                      <div className="flex-1 flex gap-6 items-start">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-red-200 text-red-600 bg-white font-black text-[10px]">
                              {report.issueType || "Report Flag"}
                            </Badge>
                            
                            <Badge className={`text-[9px] font-black uppercase border-none ${report.requestId ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                              {report.requestId ? 'Request' : 'Donation'}
                            </Badge>

                            {report.postTitle && (
                              <h4 className="font-bold text-slate-900 text-sm ml-1">Target: {report.postTitle}</h4>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="font-black text-slate-400 uppercase text-[9px] block mb-1">User Description:</span>
                            "{report.description || "No description provided."}"
                          </p>

                          {/* 🌟 NEW: UPGRADED PROFESSIONAL ADMIN COMMENT UI */}
                          {report.adminComment && (
                            <div className="mt-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-1 h-full bg-slate-800 rounded-l-xl"></div>
                              <div className="flex items-start gap-3">
                                <div className="p-1.5 bg-slate-200 rounded-lg text-slate-600 shrink-0">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1 block">
                                    Moderator Note
                                  </span>
                                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                    "{report.adminComment}"
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Footer Meta (Modified to not show "who reported who", just "Reported by") */}
                          <div className="flex flex-col gap-1.5 mt-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                              <span 
                                className="text-slate-800 cursor-pointer hover:text-violet-600 hover:underline transition-colors" 
                                onClick={() => navigate(`/admin/users/${report.reporterId}`)}
                              >
                                Reported by {report.reporterName || "Anonymous User"}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-400">
                                {report.createdAt ? new Date(report.createdAt.toMillis()).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : "Recent"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* EVIDENCE GALLERY (SIDEBAR) */}
                        {report.evidenceURLs && report.evidenceURLs.length > 0 && (
                          <div className="flex-shrink-0 flex gap-2">
                            {report.evidenceURLs.map((url, index) => (
                              <a key={index} href={url} target="_blank" rel="noreferrer">
                                <img 
                                  src={url} 
                                  alt="Evidence" 
                                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm hover:opacity-80 transition-opacity" 
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* RIGHT COLUMN: ACTIONS */}
                      <div className="flex items-start gap-2 pt-2 md:pt-0 shrink-0 flex-wrap">
                        <Button 
                          size="sm"
                          onClick={() => handleNavigation(report)}
                          className="rounded-xl bg-slate-900 text-white font-bold h-9 hover:bg-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> Inspect
                        </Button>
                        
                        {reportFilter === 'pending' && (
                          <>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReportModal(report.id, 'dismissed')}
                              className="rounded-xl border-slate-200 text-slate-600 font-bold h-9 hover:bg-slate-50"
                            >
                              <Ban className="w-3.5 h-3.5 mr-1.5" /> Dismiss
                            </Button>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReportModal(report.id, 'resolved')}
                              className="rounded-xl border-emerald-200 text-emerald-600 font-bold h-9 hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Resolve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviews Section */}
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 sm:p-6">
              <CardTitle className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-violet-500" /> Community Handover Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reviews.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold text-sm">
                  No reviews left for this user yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reviews.map(review => (
                    // 🌟 MODIFIED: Restructured layout to match the MyReviews layout (Image 3 style) to stop title crowding
                    <div key={review.id} className={`p-5 sm:p-6 transition-colors ${review.isHidden ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col items-start pr-4">
                          
                          <p className="font-bold text-slate-900 text-sm">
                            <span className="text-slate-400 font-normal mr-1">From</span> 
                            <span 
                              onClick={() => navigate(`/admin/users/${review.reviewerId}`)}
                              className="cursor-pointer hover:underline transition-colors"
                            >
                              {review.reviewerName}
                            </span>
                            {review.isHidden && (
                              <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-600 border-none text-[9px]">
                                <EyeOff className="w-3 h-3 mr-1"/> Hidden
                              </Badge>
                            )}
                          </p>

                          <button 
                            onClick={() => handleNavigation(review)}
                            className="group flex items-center gap-1.5 mt-1.5 text-left active:scale-[0.98] transition-transform"
                          >
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
                            
                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider group-hover:text-violet-600 group-hover:underline transition-colors line-clamp-1">
                              {review.transactionTitle || review.donationTitle || "Food Item"}
                            </span>
                            <ExternalLink className="w-3 h-3 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </button>
                        </div>
                        
                        <div className="flex flex-col items-end shrink-0 pt-0.5 gap-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                              ))}
                            </div>
                            <button 
                              onClick={() => handleToggleReviewVisibility(review.id, review.isHidden)}
                              className={`p-1 rounded-md transition-colors ${review.isHidden ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                              title={review.isHidden ? "Restore Review" : "Hide Review"}
                            >
                              {review.isHidden ? <Eye className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {formatReviewDate(review.createdAt)}
                          </span>
                        </div>
                      </div>

                      <p className={`text-sm italic p-3.5 rounded-2xl leading-relaxed mt-2 ${review.isHidden ? 'text-slate-400 bg-slate-100/50' : 'text-slate-600 bg-slate-50'}`}>
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