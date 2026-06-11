import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { adminRemoveDonation } from "@/features/donations/donationService";
import { adminRemoveRequest } from "@/features/requests/requestService";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, 
  User, 
  Clock, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertTriangle, 
  Activity,
  Ban,
  MessageSquare
} from "lucide-react";

export default function ModerationTab() {
  const navigate = useNavigate();
  
  const [reports, setReports] = useState([]);
  const [reportTab, setReportTab] = useState("pending");
  
  const [donationsList, setDonationsList] = useState([]);
  const [requestsList, setRequestsList] = useState([]);
  
  const [loading, setLoading] = useState(true);

  // 🌟 NEW: States for the custom Admin Action Modal
  const [modalConfig, setModalConfig] = useState({ isOpen: false, reportId: null, status: null });
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    setLoading(true);

    const reportsQ = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const donQ = query(collection(db, "donations"), orderBy("createdAt", "desc"), limit(5));
    const reqQ = query(collection(db, "requests"), orderBy("createdAt", "desc"), limit(5));
    
    const unsubReports = onSnapshot(reportsQ, (snap) => {
      const reportList = snap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toLocaleDateString() : "Recent"
        }));
      setReports(reportList);
      setLoading(false); 
    }, (error) => console.error("Reports Listener Error:", error));

    const unsubDon = onSnapshot(donQ, (snap) => {
      setDonationsList(snap.docs.map(d => ({ id: d.id, type: 'donation', ...d.data() })));
    }, (error) => console.error("Donations Listener Error:", error));

    const unsubReq = onSnapshot(reqQ, (snap) => {
      setRequestsList(snap.docs.map(r => ({ id: r.id, type: 'request', ...r.data() })));
    }, (error) => console.error("Requests Listener Error:", error));

    return () => {
      unsubReports();
      unsubDon();
      unsubReq();
    };
  }, []);

  const feed = [...donationsList, ...requestsList]
    .sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    })
    .slice(0, 10);

  // 🌟 MODIFIED: Opens the custom modal instead of window.prompt
  const handleOpenModal = (reportId, status) => {
    setModalConfig({ isOpen: true, reportId, status });
    setAdminNote(""); // Clear previous text
  };

  // 🌟 MODIFIED: Processes the update when modal is confirmed
  const handleConfirmAction = async () => {
    const { reportId, status } = modalConfig;
    if (!reportId) return;

    try {
      await updateDoc(doc(db, "reports", reportId), { 
        reportStatus: status,
        adminComment: adminNote.trim() || null 
      });
      setModalConfig({ isOpen: false, reportId: null, status: null }); // Close modal
    } catch (e) { 
      alert(`Error marking report as ${status}.`); 
    }
  };

  const handleDeletePost = async (item) => {
    if (!window.confirm(`Permanently delete this ${item.type}?`)) return;
    try {
      if (item.type === "donation") await adminRemoveDonation(item.id); 
      else await adminRemoveRequest(item.id);
    } catch (e) { alert("Error removing post."); }
  };

  const filteredReports = reports.filter(r => {
    const status = r.reportStatus || 'pending';
    return status === reportTab;
  });

  if (loading) return (
    <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-violet-600" /></div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      
      {/* 🌟 NEW: CUSTOM MODAL OVERLAY */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className={`p-5 border-b ${modalConfig.status === 'resolved' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                {modalConfig.status === 'resolved' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Ban className="w-5 h-5 text-slate-600" />}
                Confirm Action
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                You are about to mark this report as <strong className="uppercase">{modalConfig.status}</strong>.
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
                onClick={() => setModalConfig({ isOpen: false, reportId: null, status: null })}
                className="rounded-xl font-bold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmAction}
                className={`rounded-xl font-bold text-white ${modalConfig.status === 'resolved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                Confirm & Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CARD 1: USER REPORTS */}
      <Card className="rounded-[2rem] border-red-100 shadow-xl shadow-red-50/50 overflow-hidden bg-white border-2">
        <CardHeader className="bg-red-50/50 border-b border-red-100 p-5 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-xl text-white shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-slate-900">User Reports</CardTitle>
                <p className="text-xs text-red-600 font-bold uppercase tracking-tight">Platform Moderation</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex bg-white p-1 rounded-xl border border-red-100 shadow-sm w-full sm:w-auto">
                <button 
                  onClick={() => setReportTab("pending")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportTab === 'pending' ? 'bg-red-100 text-red-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >Pending</button>
                <button 
                  onClick={() => setReportTab("resolved")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportTab === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >Resolved</button>
                <button 
                  onClick={() => setReportTab("dismissed")}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportTab === 'dismissed' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >Dismissed</button>
              </div>
              <Badge className="bg-red-600 text-white border-none px-3 py-1 h-8 hidden sm:flex items-center">
                {filteredReports.length} {filteredReports.length === 1 ? 'Flag' : 'Flags'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {filteredReports.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-medium italic">
                No {reportTab} reports found.
              </div>
            ) : (
              filteredReports.map((report) => {
                const isRequestFlow = !!report.requestId;

                return (
                  <div key={report.id} className="p-6 flex flex-col md:flex-row gap-6 justify-between bg-white hover:bg-red-50/20 transition-colors">
                    
                    {/* LEFT COLUMN */}
                    <div className="flex-1 flex gap-6 items-start">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-red-200 text-red-600 bg-white font-black text-[10px]">
                            {report.issueType}
                          </Badge>
                          
                          <Badge className={`text-[9px] font-black uppercase border-none ${isRequestFlow ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                            {isRequestFlow ? 'Request' : 'Donation'}
                          </Badge>

                          <h4 className="font-bold text-slate-900 text-sm ml-1">Target: {report.postTitle}</h4>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="font-black text-slate-400 uppercase text-[9px] block mb-1">User Description:</span>
                          "{report.description}"
                        </p>

                        {/* 🌟 MODIFIED: UPGRADED PROFESSIONAL ADMIN COMMENT UI */}
                        {report.adminComment && (
                          <div className="mt-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                            {/* Color Bar Accent */}
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
                        
                        {/* Footer Meta */}
                        <div className="flex flex-col gap-1.5 mt-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
                            <User className="w-3 h-3 text-slate-400" />
                            <span 
                              className="text-slate-800 cursor-pointer hover:text-violet-600 hover:underline transition-colors" 
                              onClick={() => navigate(`/admin/users/${report.reporterId}`)}
                            >
                              {report.reporterName}
                            </span>
                            {report.reporterRole && (
                              <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 font-black uppercase bg-slate-100 text-slate-500">
                                {report.reporterRole}
                              </Badge>
                            )}
                            <span className="text-slate-400 mx-1">reported</span>
                            <span 
                              className="text-slate-800 font-bold cursor-pointer hover:text-violet-600 hover:underline transition-colors truncate max-w-[120px]" 
                              onClick={() => navigate(`/admin/users/${report.reportedUserId}`)}
                              title={report.reportedUserId}
                            >
                              {report.reportedUserName || "Unknown User"}
                            </span>
                            {report.reportedUserRole && (
                              <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 font-black uppercase bg-slate-100 text-slate-500">
                                {report.reportedUserRole}
                              </Badge>
                            )}
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Clock className="w-3 h-3" /> {report.date}
                          </span>
                        </div>
                      </div>

                      {/* EVIDENCE GALLERY */}
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
                        onClick={() => navigate(report.requestId ? `/requests/${report.requestId}` : `/donations/${report.donationId}`)}
                        className="rounded-xl bg-slate-900 text-white font-bold h-9 hover:bg-slate-800"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Inspect
                      </Button>
                      
                      {reportTab === 'pending' && (
                        <>
                          <Button 
                            size="sm"
                            variant="outline"
                            // 🌟 MODIFIED: Trigger Custom Modal
                            onClick={() => handleOpenModal(report.id, 'dismissed')}
                            className="rounded-xl border-slate-200 text-slate-600 font-bold h-9 hover:bg-slate-50"
                          >
                            <Ban className="w-3.5 h-3.5 mr-1.5" /> Dismiss
                          </Button>
                          <Button 
                            size="sm"
                            variant="outline"
                            // 🌟 MODIFIED: Trigger Custom Modal
                            onClick={() => handleOpenModal(report.id, 'resolved')}
                            className="rounded-xl border-emerald-200 text-emerald-600 font-bold h-9 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Resolve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* CARD 2: LIVE ACTIVITY */}
      <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden bg-white border-2">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center flex-row">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-600 rounded-xl text-white">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-black text-slate-900">Live Activity</CardTitle>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Recent Donations & Requests</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-slate-200 text-slate-700">{feed.length} Recent</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {feed.map((item) => (
              <div key={item.id} className="p-5 flex flex-col md:flex-row gap-4 md:items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${item.status === 'available' || item.status === 'open' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900 truncate max-w-[200px]">{item.foodName}</h4>
                      <Badge className={`text-[9px] font-black uppercase ${item.type === 'donation' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{item.type}</Badge>
                      <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400 border-slate-200">{item.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {item.donorName || item.requesterName}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : "Just now"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => navigate(`/${item.type}s/${item.id}`)} variant="outline" className="text-xs h-8 rounded-xl font-bold border-slate-200 text-slate-600">
                    <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                  </Button>
                  <Button onClick={() => handleDeletePost(item)} variant="outline" className="text-xs h-8 rounded-xl font-bold border-red-100 text-red-500 hover:bg-red-50">
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}