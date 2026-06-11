import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";

// Enterprise Charting Library
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// 🌟 MODIFIED: Imported Recycle icon for Waste Prevented
import { Users, PackageSearch, HeartHandshake, TrendingUp, AlertCircle, Leaf, Wallet, Smile, Droplets, TreePine, Clock, Recycle } from "lucide-react";

export default function PlatformMetricsTab() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [systemLogs, setSystemLogs] = useState([]);
  
  // 🌟 1. 100% LIVE DATA STATES (Only for Top 4 Cards)
  const [liveCounts, setLiveCounts] = useState({
    users: 0,
    activeDonations: 0,
    openRequests: 0,
    completedDonationsQty: 0,
    completedRequestsQty: 0
  });

  // 2. Master Analytics State (From Database Only)
  const [dashboardData, setDashboardData] = useState({
    lastUpdated: null,
    // 🌟 MODIFIED: Added wastePreventedKg to initial state
    impact: { totalMeals: 0, co2SavedKg: 0, valueSavedRM: 0, waterSavedLiters: 0, treesEquivalent: 0, uniquePeople: 0, totalRegisteredUsers: 0, wastePreventedKg: 0 },
    weeklyStats: [],
    hotspots: []
  });

  const COLORS = ['#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899'];

  useEffect(() => {
    setIsLoading(true);

    // --- A. FETCH DB ANALYTICS ONCE (Charts & Impact) ---
    getDoc(doc(db, "analytics", "dashboard_chart")).then(analyticsDoc => {
      if (analyticsDoc.exists()) {
        const data = analyticsDoc.data();
        let formattedDate = "Just now";
        
        if (data.lastUpdated?.toDate) {
          formattedDate = data.lastUpdated.toDate().toLocaleString('en-MY', { 
            day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true 
          });
        }

        setDashboardData({
          lastUpdated: formattedDate,
          impact: data.impact || dashboardData.impact,
          weeklyStats: data.weeklyStats || [],
          hotspots: data.hotspots || []
        });
      }
      setIsLoading(false);
    }).catch(e => console.error("Analytics Error", e));

    // --- B. REAL-TIME LISTENERS (Top 4 Cards & Logs) ---
    const unsubUsers = onSnapshot(collection(db, "users"), snap => {
      setLiveCounts(prev => ({ ...prev, users: snap.size }));
    });

    const unsubActiveDon = onSnapshot(query(collection(db, "donations"), where("status", "in", ["available", "reserved"])), snap => {
      setLiveCounts(prev => ({ ...prev, activeDonations: snap.size }));
    });

    const unsubOpenReq = onSnapshot(query(collection(db, "requests"), where("status", "in", ["open", "fulfilled"])), snap => {
      setLiveCounts(prev => ({ ...prev, openRequests: snap.size }));
    });

    const unsubCompDon = onSnapshot(query(collection(db, "donations"), where("status", "==", "completed")), snap => {
      let total = 0;
      snap.forEach(d => total += (Number(d.data().quantity) || 1));
      setLiveCounts(prev => ({ ...prev, completedDonationsQty: total }));
    });

    const unsubCompReq = onSnapshot(query(collection(db, "requests"), where("status", "==", "completed")), snap => {
      let total = 0;
      snap.forEach(r => total += (Number(r.data().quantity) || 1));
      setLiveCounts(prev => ({ ...prev, completedRequestsQty: total }));
    });

    const unsubLogs = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5)), snap => {
      const fetchedLogs = snap.docs.map(userDoc => {
        const data = userDoc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const hoursAgo = Math.floor((new Date() - createdAt) / (1000 * 60 * 60));
        return {
          id: userDoc.id,
          email: data.email,
          displayName: data.fullName || data.displayName || "New User",
          timeText: hoursAgo === 0 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`
        };
      });
      setSystemLogs(fetchedLogs);
    });

    return () => {
      unsubUsers(); unsubActiveDon(); unsubOpenReq(); 
      unsubCompDon(); unsubCompReq(); unsubLogs();
    };
  }, []);

  const totalMealsRescuedLive = liveCounts.completedDonationsQty + liveCounts.completedRequestsQty;

  // --- SUB-COMPONENTS ---
  const CardSkeleton = () => (
    <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardContent className="p-5 flex justify-between items-center">
        <div className="space-y-3 w-full">
          <div className="h-3 w-20 bg-slate-200 rounded animate-pulse"></div>
          <div className="h-8 w-12 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-100 animate-pulse w-12 h-12"></div>
      </CardContent>
    </Card>
  );

  const StatCard = ({ title, value, icon: Icon, colorClass = "text-violet-600", bgClass = "bg-violet-50" }) => (
    <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex justify-between items-center">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
          <p className="text-3xl font-black text-slate-900">{value}</p>
        </div>
        <div className={`p-3.5 rounded-2xl ${bgClass} ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );

  const MetricBadge = ({ icon: Icon, label, value, unit, color }) => {
    const colorStyles = {
      emerald: "bg-emerald-500/20 text-emerald-400",
      blue: "bg-blue-500/20 text-blue-400",
      amber: "bg-amber-500/20 text-amber-400",
      violet: "bg-violet-500/20 text-violet-400",
      pink: "bg-pink-500/20 text-pink-400",
    };
    return (
      <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/5 backdrop-blur-md hover:bg-white/15 transition-colors w-full">
        <div className={`p-3 rounded-xl shrink-0 ${colorStyles[color]}`}><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest truncate ${colorStyles[color].split(' ')[1]}`}>{label}</p>
          <p className="text-xl font-black text-white truncate">{isLoading ? "..." : value} <span className="text-xs text-slate-400 font-bold">{unit}</span></p>
        </div>
      </div>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const fullDateStr = payload[0].payload.fullDate || label;
      return (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-xl min-w-[160px]">
          <p className="text-slate-300 font-bold text-xs mb-3 border-b border-slate-700 pb-2">{fullDateStr}</p>
          {payload.map((entry, index) => {
            let displayName = entry.name;
            if (displayName === "volume") displayName = "Total Rescued";
            if (displayName === "supply") displayName = "Donations Posted";
            if (displayName === "demand") displayName = "Requests Made";

            const dotColor = entry.color || entry.fill || '#10b981';

            return (
              <div key={index} className="flex justify-between items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }}></div>
                  <span className="text-xs font-semibold text-slate-300 capitalize">{displayName}</span>
                </div>
                <span className="text-sm font-black text-white">{entry.value}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      
      {/* 1. TOP CARDS (100% Live) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {isLoading ? (
          <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
        ) : (
          <>
            <StatCard title="Total Users" value={liveCounts.users} icon={Users} colorClass="text-blue-600" bgClass="bg-blue-50" />
            <StatCard title="Active Listings" value={liveCounts.activeDonations} icon={PackageSearch} colorClass="text-orange-600" bgClass="bg-orange-50" />
            <StatCard title="Open Requests" value={liveCounts.openRequests} icon={HeartHandshake} colorClass="text-pink-600" bgClass="bg-pink-50" />
            <StatCard title="Total Rescued" value={totalMealsRescuedLive} icon={TrendingUp} colorClass="text-violet-600" bgClass="bg-violet-50" />
          </>
        )}
      </div>

      {/* 2. THE ULTIMATE IMPACT BANNER (DB Driven) */}
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 shadow-2xl text-white relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col xl:flex-row justify-between gap-8">
          <div className="xl:w-1/3 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 mb-4 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Live Global Impact
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-3 tracking-tight leading-tight">
              Making a <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-violet-400">Difference.</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm mb-5">
              Real-time environmental and economic metrics aggregated daily by the KindBite matchmaking engine.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/80 text-[11px] font-semibold text-slate-400 w-fit shadow-sm">
              <Clock className="w-3.5 h-3.5" /> As of {dashboardData.lastUpdated || "Loading..."}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 xl:w-2/3">
            <MetricBadge icon={Leaf} label="CO₂ Prevented" value={dashboardData.impact.co2SavedKg.toLocaleString()} unit="kg" color="emerald" />
            <MetricBadge icon={Droplets} label="Water Saved" value={(dashboardData.impact.waterSavedLiters / 1000).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} unit="kL" color="blue" />
            <MetricBadge icon={Wallet} label="Econ Value" value={dashboardData.impact.valueSavedRM.toLocaleString()} unit="RM" color="amber" />
            {/* 🌟 MODIFIED: Swapped "Meals Rescued" for "Waste Prevented" */}
            <MetricBadge icon={Recycle} label="Waste Prevented" value={dashboardData.impact.wastePreventedKg?.toLocaleString() || "0"} unit="kg" color="violet" />
            <MetricBadge icon={TreePine} label="Trees Eqv." value={dashboardData.impact.treesEquivalent.toLocaleString()} unit="Trees" color="emerald" />
            <MetricBadge icon={Smile} label="Lives Touched" value={dashboardData.impact.uniquePeople.toLocaleString()} unit="People" color="pink" />
          </div>
        </div>
      </div>

      {/* 3. CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bar Chart (Rescue Volume) */}
        <Card className="col-span-1 lg:col-span-2 rounded-3xl border-slate-200 shadow-sm bg-white flex flex-col">
          <CardHeader className="border-b border-slate-100 p-5 flex flex-row items-center justify-between space-y-0 flex-nowrap overflow-hidden">
            <CardTitle className="text-base font-bold text-slate-800 truncate pr-2">Rescue Volume (Last 7 Days)</CardTitle>
            <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Clock className="w-3.5 h-3.5" /> As of {dashboardData.lastUpdated}
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 min-h-[300px]">
            {isLoading ? (
              <div className="w-full h-full bg-slate-50 rounded-xl animate-pulse"></div>
            ) : dashboardData.weeklyStats.length === 0 || dashboardData.weeklyStats.every(d => d.volume === 0) ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">No rescues completed this week yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.weeklyStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
                    {dashboardData.weeklyStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#8b5cf6" className="transition-all duration-300 hover:opacity-80" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* SYSTEM LOGS (Live) */}
        <Card className="col-span-1 rounded-3xl border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 p-5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400" /> Recent Signups
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {systemLogs.length === 0 ? (
                <div className="p-8 text-center text-sm font-bold text-slate-400">No recent activity.</div>
              ) : (
                systemLogs.map((log) => (
                  <div key={log.id} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors items-center cursor-default">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                    <div className="overflow-hidden">
                      {/* 🌟 MODIFIED: Clickable Name routing to Admin User View */}
                      <p 
                        className="text-sm font-bold text-slate-700 truncate cursor-pointer hover:text-violet-600 hover:underline transition-colors w-fit"
                        onClick={() => navigate(`/admin/users/${log.id}`)}
                      >
                        {log.displayName}
                      </p>
                      <p className="text-xs text-slate-500 font-medium truncate">{log.email}</p>
                    </div>
                    <span className="ml-auto text-[10px] font-bold text-slate-400 whitespace-nowrap bg-slate-100 px-2 py-1 rounded-md">{log.timeText}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. CHARTS ROW 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Area Chart (Supply vs Demand) */}
        <Card className="col-span-1 lg:col-span-2 rounded-3xl border-slate-200 shadow-sm bg-white flex flex-col">
          <CardHeader className="border-b border-slate-100 p-5 flex flex-row items-center justify-between space-y-0 flex-nowrap overflow-hidden">
            <CardTitle className="text-base font-bold text-slate-800 truncate pr-2">Market Activity</CardTitle>
            <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Clock className="w-3.5 h-3.5" /> As of {dashboardData.lastUpdated}
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 min-h-[300px]">
            {isLoading ? (
              <div className="w-full h-full bg-slate-50 rounded-xl animate-pulse"></div>
            ) : dashboardData.weeklyStats.length === 0 || dashboardData.weeklyStats.every(d => d.supply === 0 && d.demand === 0) ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">No new posts or requests in the last 7 days.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.weeklyStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSupply" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="supply" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSupply)" name="Food Donated" />
                  <Area type="monotone" dataKey="demand" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorDemand)" name="Food Requested" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Hotspots Donut Chart */}
        <Card className="col-span-1 rounded-3xl border-slate-200 shadow-sm bg-white flex flex-col">
          {/* 🌟 FIX: Absolute one-line un-wrappable structure */}
          <CardHeader className="border-b border-slate-100 p-5 flex flex-row items-center justify-between space-y-0 flex-nowrap overflow-hidden">
            <CardTitle className="text-base font-bold text-slate-800 truncate pr-2">
              Donation Hotspots
            </CardTitle>
            <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Clock className="w-3.5 h-3.5" /> As of {dashboardData.lastUpdated}
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 min-h-[300px] flex items-center justify-center">
            {isLoading ? (
              <div className="w-48 h-48 rounded-full border-8 border-slate-100 animate-pulse"></div>
            ) : dashboardData.hotspots.length === 0 ? (
              <div className="text-slate-400 font-bold text-sm text-center">No location data found<br/>for recent donations.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={dashboardData.hotspots}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {dashboardData.hotspots.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}