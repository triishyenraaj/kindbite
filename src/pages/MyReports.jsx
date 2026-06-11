import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { useAuth } from "@/features/auth/useAuth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Ban, MessageSquare, Loader2, Clock, Eye, User } from "lucide-react";

export default function MyReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🌟 NEW: State to track the active tab
  const [reportTab, setReportTab] = useState("pending");

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    // Fetch only the reports where the current user is the reporter
    const q = query(collection(db, "reports"), where("reporterId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort newest first in memory
      const sorted = data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      
      setReports(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown Date";
    const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
    return date.toLocaleDateString('en-MY', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusDetails = (status) => {
    switch(status) {
      case 'resolved':
        return { label: 'Resolved', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> };
      case 'dismissed':
        return { label: 'Dismissed', bg: 'bg-slate-200', text: 'text-slate-700', icon: <Ban className="w-3.5 h-3.5 mr-1.5" /> };
      default:
        return { label: 'Pending Review', bg: 'bg-orange-100', text: 'text-orange-700', icon: <Clock className="w-3.5 h-3.5 mr-1.5" /> };
    }
  };

  // 🌟 NEW: Filter reports based on the active tab
  const filteredReports = reports.filter(r => {
    const status = r.reportStatus || 'pending';
    return status === reportTab;
  });

  return (
    <div className="mx-auto max-w-4xl py-10 px-4 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-100 shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900">My Reports</h1>
            <p className="text-sm font-medium text-slate-500">History of issues you have submitted to moderation.</p>
          </div>
        </div>

        {/* 🌟 NEW: Filter Tabs UI */}
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0 w-full md:w-auto">
          <button 
            onClick={() => setReportTab("pending")}
            className={`flex-1 md:flex-none px-4 py-2 md:py-1.5 text-xs font-bold rounded-lg transition-colors ${reportTab === 'pending' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >Pending</button>
          <button 
            onClick={() => setReportTab("resolved")}
            className={`flex-1 md:flex-none px-4 py-2 md:py-1.5 text-xs font-bold rounded-lg transition-colors ${reportTab === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >Resolved</button>
          <button 
            onClick={() => setReportTab("dismissed")}
            className={`flex-1 md:flex-none px-4 py-2 md:py-1.5 text-xs font-bold rounded-lg transition-colors ${reportTab === 'dismissed' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >Dismissed</button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : reports.length === 0 ? (
        // Entirely Empty State
        <Card className="rounded-[2rem] border-dashed border-2 border-slate-200 bg-slate-50/50 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Reports Submitted</h3>
            <p className="text-slate-500 max-w-sm leading-relaxed text-sm">
              You haven't reported any issues yet. Thank you for keeping the KindBite community safe!
            </p>
          </CardContent>
        </Card>
      ) : filteredReports.length === 0 ? (
        // 🌟 NEW: Tab-Specific Empty State
        <Card className="rounded-[2rem] border-dashed border-2 border-slate-200 bg-slate-50/50 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
             <p className="text-slate-400 font-medium italic">
                You have no <span className="font-bold text-slate-500">{reportTab}</span> reports.
             </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 🌟 MODIFIED: Now maps over filteredReports instead of all reports */}
          {filteredReports.map((report) => {
            const statusInfo = getStatusDetails(report.reportStatus);
            const isRequestFlow = !!report.requestId;

            return (
              <Card key={report.id} className="rounded-[1.5rem] border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow bg-white">
                <CardContent className="p-0">
                  <div className="p-6 flex flex-col md:flex-row gap-6 justify-between">
                    
                    {/* LEFT COLUMN: Report Info */}
                    <div className="flex-1 space-y-3">
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-red-200 text-red-600 bg-white font-black text-[10px]">
                          {report.issueType || "Issue Reported"}
                        </Badge>
                        
                        <Badge className={`text-[9px] font-black uppercase border-none ${isRequestFlow ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                          {isRequestFlow ? 'Request' : 'Donation'}
                        </Badge>

                        <h4 className="font-bold text-slate-900 text-sm ml-1">Target: {report.postTitle || "Unknown Post"}</h4>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Reported User:</span>
                        <span 
                          className="text-slate-800 cursor-pointer hover:text-violet-600 hover:underline transition-colors truncate max-w-[150px]"
                          onClick={() => navigate(`/user/${report.reportedUserId}`)}
                          title="View public profile"
                        >
                          {report.reportedUserName || "Unknown User"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="font-black text-slate-400 uppercase text-[9px] block mb-1">Your Description:</span>
                        "{report.description}"
                      </p>

                      {/* Evidence Gallery */}
                      {report.evidenceURLs && report.evidenceURLs.length > 0 && (
                        <div className="flex-shrink-0 flex gap-2 mt-2">
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

                      {/* Moderator Response */}
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

                    </div>

                    {/* RIGHT COLUMN: Meta & Actions */}
                    <div className="flex flex-col items-start md:items-end gap-4 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                      
                      <div className="flex flex-col items-start md:items-end gap-1 w-full">
                        <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.text} text-[10px] font-black uppercase tracking-wider px-3 py-1 flex items-center shadow-none mb-1`}>
                          {statusInfo.icon} {statusInfo.label}
                        </Badge>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDate(report.createdAt)}
                        </p>
                      </div>

                      <div className="mt-auto pt-2 w-full md:w-auto">
                        {(report.donationId || report.requestId) && (
                          <Button 
                            size="sm"
                            onClick={() => navigate(report.donationId ? `/donations/${report.donationId}` : `/requests/${report.requestId}`)}
                            className="rounded-xl bg-slate-900 text-white font-bold h-9 w-full md:w-auto hover:bg-slate-800"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" /> Inspect Post
                          </Button>
                        )}
                      </div>

                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}