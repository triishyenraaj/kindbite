import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { ShieldCheck, BarChart3, AlertOctagon, Users, Download, Loader2 } from "lucide-react";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "@/services/firebase/config";

// 🌟 THE UPDATED IMPORTS
import PlatformMetricsTab from "@/features/admin/tabs/PlatformMetricsTab";
import ModerationTab from "@/features/admin/tabs/ModerationTab";
import UserDirectoryTab from "@/features/admin/tabs/UserDirectoryTab";

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState("metrics"); 
  const [isExporting, setIsExporting] = useState(false);

  const handleExportClick = async () => {
    setIsExporting(true);
    try {
      // 1. Fetch Metrics Data from the analytics document
      const metricsSnap = await getDoc(doc(db, "analytics", "dashboard_chart"));
      const metrics = metricsSnap.exists() ? metricsSnap.data().impact || {} : {};
      
      // 2. Fetch the live users collection (used for both the directory and accurate total count)
      const usersSnap = await getDocs(collection(db, "users"));
      const liveTotalUsers = usersSnap.size; // Matches top card live count

      // 3. Fetch completed queries to match the "Total Rescued" live card calculation
      const completedDonationsSnap = await getDocs(query(collection(db, "donations"), where("status", "==", "completed")));
      const completedRequestsSnap = await getDocs(query(collection(db, "requests"), where("status", "==", "completed")));
      
      let liveCompletedDonationsQty = 0;
      let liveCompletedRequestsQty = 0;
      
      completedDonationsSnap.forEach(d => liveCompletedDonationsQty += (Number(d.data().quantity) || 1));
      completedRequestsSnap.forEach(r => liveCompletedRequestsQty += (Number(r.data().quantity) || 1));
      
      const liveTotalRescued = liveCompletedDonationsQty + liveCompletedRequestsQty; // Matches top card live calculation

      // 4. Build CSV String - Section 1: Metrics (Now aligned 100% with UI)
      let csvContent = "--- PLATFORM METRICS ---\n";
      csvContent += "Metric,Value\n";
      csvContent += `Total Users (Live),${liveTotalUsers}\n`;
      csvContent += `Total Meals Rescued (Live),${liveTotalRescued}\n`;
      csvContent += `CO2 Prevented (kg),${metrics.co2SavedKg || 0}\n`;
      csvContent += `Water Saved (Liters),${metrics.waterSavedLiters || 0}\n`;
      csvContent += `Economic Value Saved (RM),${metrics.valueSavedRM || 0}\n`;
      csvContent += `Waste Prevented (kg),${metrics.wastePreventedKg || 0}\n`;
      csvContent += `Trees Equivalent,${metrics.treesEquivalent || 0}\n`; // ✨ ADDED MISSING FIELD
      csvContent += `Lives Touched,${metrics.uniquePeople || 0}\n`;
      
      csvContent += "\n"; // Blank line separating sections
      
      // 5. Build CSV String - Section 2: User Directory
      csvContent += "--- USER DIRECTORY ---\n";
      csvContent += "User ID,Full Name,Email,Role,Status,Joined Date\n";
      
      usersSnap.docs.forEach(docSnap => {
        const d = docSnap.data();
        const date = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : "Unknown";
        
        // Escape strings to prevent commas from shifting rows
        const safeName = `"${(d.fullName || "N/A").replace(/"/g, '""')}"`;
        const safeEmail = `"${(d.email || "N/A").replace(/"/g, '""')}"`;
        
        csvContent += `${docSnap.id},${safeName},${safeEmail},${d.role || "user"},${d.status || "active"},${date}\n`;
      });

      // 6. Create Blob and Trigger Download
      const dateStr = new Date().toISOString().split('T')[0];
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `KindBite_System_Report_${dateStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export report.");
    } finally {
      setIsExporting(false);
    }
  };

  const TabButton = ({ id, icon: Icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`flex flex-1 md:flex-none items-center justify-center md:justify-start gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
          isActive 
            ? "bg-white text-violet-700 shadow-sm border border-slate-200/50" 
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="max-w-screen-xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-violet-600" />
              <span className="text-xs font-black tracking-widest text-violet-600 uppercase">System Admin</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Command Center</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Welcome back, <span className="font-bold">{currentUser?.email}</span>. Monitor health, manage users, and moderate content.
            </p>
          </div>
          <button 
            onClick={handleExportClick}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-all border border-slate-200 shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-slate-400" />
            )}
            {isExporting ? "Exporting..." : "Export CSV Report"}
          </button>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex p-1 bg-slate-200/50 rounded-xl border border-slate-200/50 w-full md:w-fit">
          <TabButton id="metrics" icon={BarChart3} label="Platform Metrics" />
          <TabButton id="moderation" icon={AlertOctagon} label="Moderation Queue" />
          <TabButton id="users" icon={Users} label="User Directory" />
        </div>

        {/* DYNAMIC TAB RENDERING */}
        {activeTab === "metrics" && <PlatformMetricsTab />}
        {activeTab === "moderation" && <ModerationTab />}
        {activeTab === "users" && <UserDirectoryTab />}

      </div>
    </div>
  );
}