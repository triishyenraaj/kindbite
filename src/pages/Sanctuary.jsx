import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";

// Firebase
import { collection, query, where, onSnapshot, doc, orderBy, limit } from "firebase/firestore";
import { db } from "@/services/firebase/config";

// UI Component Imports
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

// Lucide Icon Imports (Added Award)
import { ArrowLeft, Flame, Trophy, Sparkles, Leaf, Recycle, HeartHandshake, Star, Target, Crown, Medal, Loader2, ShoppingBag, Lock, Download, X, Award } from "lucide-react";

// 🌟 Import your high-performance Canvas Forest
import ImpactForest from "@/components/ImpactForest"; // <-- Ensure this path is correct!

/* ═══════════════════════════════════════════════════════════════
   ANIMATED COUNTER HOOK
═══════════════════════════════════════════════════════════════ */
function useCounter(target, duration = 1500) {
  const [val, setVal] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const initialVal = prevTarget.current;
    if (initialVal === target) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(initialVal + progress * (target - initialVal)));
      if (progress < 1) requestAnimationFrame(step);
      else prevTarget.current = target;
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return val;
}

/* ═══════════════════════════════════════════════════════════════
   LEADERBOARD MEDAL
═══════════════════════════════════════════════════════════════ */
function LeaderboardMedal({ color }) {
  const colorMap = {
    yellow: "text-yellow-500 fill-yellow-500/20",
    slate:  "text-slate-300 fill-slate-300/20",
    amber:  "text-amber-600 fill-amber-600/20",
  };
  return <Medal className={`w-5 h-5 mx-auto ${colorMap[color]}`} />;
}

/* ═══════════════════════════════════════════════════════════════
   SANCTUARY PAGE
═══════════════════════════════════════════════════════════════ */
export default function Sanctuary() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [reputation, setReputation] = useState({ average: 0, total: 0 });
  const [givenQty, setGivenQty] = useState(0);
  const [gotQty, setGotQty] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  // Certificate Modal State
  const [showCert, setShowCert] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const certRef = useRef(null);

  /* ── Firebase live listeners ── */
  useEffect(() => {
    if (!user?.uid) return;

    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) setProfile({ id: docSnap.id, ...docSnap.data() });
    });

    const qLeaderboard = query(collection(db, "users"), orderBy("kindPoints", "desc"), limit(10));
    const unsubLeaderboard = onSnapshot(qLeaderboard, (snap) => {
      setLeaderboard(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qReviews = query(collection(db, "reviews"), where("revieweeId", "==", user.uid));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const visible = snap.docs.map((d) => d.data()).filter((r) => !r.isHidden);
      if (visible.length > 0) {
        const totalScore = visible.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
        setReputation({ average: (totalScore / visible.length).toFixed(1), total: visible.length });
      }
    });

    let gaveDon = 0, gaveReq = 0, gotDon = 0, gotReq = 0;
    const updateImpact = () => { setGivenQty(gaveDon + gaveReq); setGotQty(gotDon + gotReq); };

    const unsubGaveDon = onSnapshot(
      query(collection(db, "donations"), where("donorId", "==", user.uid), where("status", "==", "completed")),
      (snap) => { gaveDon = 0; snap.forEach((d) => (gaveDon += Number(d.data().quantity || 0))); updateImpact(); }
    );
    const unsubGaveReq = onSnapshot(
      query(collection(db, "requests"), where("donorId", "==", user.uid), where("status", "==", "completed")),
      (snap) => { gaveReq = 0; snap.forEach((d) => (gaveReq += Number(d.data().quantity || 0))); updateImpact(); }
    );
    const unsubGotDon = onSnapshot(
      query(collection(db, "donations"), where("recipientId", "==", user.uid), where("status", "==", "completed")),
      (snap) => { gotDon = 0; snap.forEach((d) => (gotDon += Number(d.data().quantity || 0))); updateImpact(); }
    );
    const unsubGotReq = onSnapshot(
      query(collection(db, "requests"), where("requesterId", "==", user.uid), where("status", "==", "completed")),
      (snap) => { gotReq = 0; snap.forEach((d) => (gotReq += Number(d.data().quantity || 0))); updateImpact(); }
    );

    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      clearTimeout(timer);
      unsubProfile(); unsubLeaderboard(); unsubReviews();
      unsubGaveDon(); unsubGaveReq(); unsubGotDon(); unsubGotReq();
    };
  }, [user?.uid]);

  /* ── Gamification math ── */
  const liveXP = profile?.kindPoints || 0;
  const totalCombinedImpact = givenQty + gotQty;

  const level = Math.floor(liveXP / 300) + 1;
  const currentLevelBaseXP = (level - 1) * 300;
  const xpProgress = ((liveXP - currentLevelBaseXP) / 300) * 100;
  const xpToNextLevel = 300 - (liveXP - currentLevelBaseXP);

  // Progressive Difficulty Rank Tiers
  const RANK_TIERS = [
    { name: "Seed",     unlockLevel: 1 },
    { name: "Sprout",   unlockLevel: 3 },
    { name: "Hero",     unlockLevel: 6 },
    { name: "Guardian", unlockLevel: 10 },
    { name: "Legend",   unlockLevel: 15 },
  ];

  let rankIdx = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (level >= RANK_TIERS[i].unlockLevel) {
      rankIdx = i;
      break;
    }
  }
  const currentRank = RANK_TIERS[rankIdx];

  const mealsShared  = useCounter(givenQty);
  const mealsRescued = useCounter(gotQty);
  const wasteSaved   = useCounter(totalCombinedImpact * 0.5);
  const co2Saved     = useCounter(totalCombinedImpact * 1.25);

  /* ── Badges ── */
  const BADGES = [
    { icon: <Leaf className="w-6 h-6 text-emerald-400" />,        name: "First Rescue",    earned: totalCombinedImpact >= 1 },
    { icon: <Flame className="w-6 h-6 text-orange-400" />,        name: "Giver",           earned: givenQty >= 5 },
    { icon: <Star className="w-6 h-6 text-yellow-400" />,         name: "5-Star Rep",      earned: reputation.average >= 5 && reputation.total >= 3 },
    { icon: <HeartHandshake className="w-6 h-6 text-violet-400" />, name: "Community Pillar", earned: liveXP > 1000 },
    { icon: <Target className="w-6 h-6 text-red-400" />,          name: "100 Meals",       earned: totalCombinedImpact >= 100 },
    { icon: <Crown className="w-6 h-6 text-yellow-500" />,        name: "KindBite Top 10", earned: leaderboard.some((lb) => lb.id === user?.uid) },
  ];

  /* ── Certificate Download Logic ── */
  const downloadCertificate = async () => {
    if (!certRef.current) return;
    try {
      setIsDownloading(true);
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(certRef.current, {
        scale: 2, // High resolution
        backgroundColor: "#020617", // slate-950
        useCORS: true, // Allow fetching images
      });
      
      const link = document.createElement("a");
      link.download = `KindBite_Certificate_${profile?.fullName || "Hero"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to generate certificate:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  /* ── Loading screen ── */
  if (loading) return (
    <div className="flex flex-col h-screen items-center justify-center bg-slate-950 gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
      <span className="text-violet-500 font-bold uppercase tracking-widest">Entering Sanctuary...</span>
    </div>
  );

  /* ── Main render ── */
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 pb-12 w-full font-sans animate-in fade-in duration-700">

      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-slate-950 border-b border-white/10 px-4 sm:px-8 py-4 flex items-center gap-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-violet-400" />
        </button>
        <h1 className="text-xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" /> The Sanctuary
        </h1>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-8 space-y-8">

        {/* 1. IMPACT DASHBOARD */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/80 border-white/5 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
            <CardContent className="p-4 sm:p-6">
              <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-amber-400" /> Meals Shared
              </p>
              <h3 className="text-3xl sm:text-4xl font-black text-white">{mealsShared.toLocaleString()}</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium">donated to others</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-white/5 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
            <CardContent className="p-4 sm:p-6">
              <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" /> Meals Rescued
              </p>
              <h3 className="text-3xl sm:text-4xl font-black text-white">{mealsRescued.toLocaleString()}</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium">saved from waste</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-white/5 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            <CardContent className="p-4 sm:p-6">
              <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-2">
                <Recycle className="w-4 h-4 text-violet-400" /> Waste Saved
              </p>
              <h3 className="text-3xl sm:text-4xl font-black text-white">
                {wasteSaved.toLocaleString()}
                <span className="text-sm sm:text-lg text-violet-400 ml-1">kg</span>
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium">diverted from landfill</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-white/5 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-blue-500" />
            <CardContent className="p-4 sm:p-6">
              <p className="text-[9px] sm:text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-sky-400" /> CO₂ Avoided
              </p>
              <h3 className="text-3xl sm:text-4xl font-black text-white">
                {co2Saved.toLocaleString()}
                <span className="text-sm sm:text-lg text-sky-400 ml-1">kg</span>
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 font-medium">emissions prevented</p>
            </CardContent>
          </Card>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* LEFT COLUMN */}
          <div className="xl:col-span-8 space-y-8">
            {/* ── IMPACT FOREST ── */}
            <ImpactForest totalCombinedImpact={totalCombinedImpact} />

            {/* BADGES */}
            <Card className="bg-slate-900 border-white/5 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Achievements</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {BADGES.map((b, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-3 text-center transition-all ${
                      b.earned
                        ? "bg-violet-950/30 border border-violet-500/20 hover:scale-105 hover:bg-violet-900/40 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                        : "bg-white/5 border border-white/5 opacity-50 grayscale"
                    }`}
                  >
                    <div className={`p-3 rounded-full ${b.earned ? "bg-violet-900/50 shadow-[0_0_15px_rgba(139,92,246,0.3)]" : "bg-slate-800"}`}>
                      {b.icon}
                    </div>
                    <span className={`text-xs font-bold ${b.earned ? "text-violet-200" : "text-slate-500"}`}>{b.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="xl:col-span-4 space-y-8">
            {/* XP & RANK */}
            <Card className="bg-slate-900 border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-4 mb-8">
                <Avatar className="w-14 h-14 border-2 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)] bg-slate-800">
                  <AvatarImage src={profile?.photoURL} className="object-cover" />
                  <AvatarFallback className="text-violet-400 font-black text-xl">
                    {profile?.fullName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-black text-white">{profile?.fullName || "Hero"}</h2>
                  <p className="text-xs font-bold text-violet-400 uppercase tracking-widest">
                    {currentRank.name} Level {level}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span className="text-white">{liveXP.toLocaleString()} <span className="text-violet-400">KP</span></span>
                  <span>{xpToNextLevel} to next rank</span>
                </div>
                <Progress
                  value={xpProgress}
                  className="h-3 bg-slate-800 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-400"
                />
              </div>

              <div className="flex gap-2">
                {RANK_TIERS.map((tier, i) => {
                  const isPassed = i < rankIdx;
                  const isCurrent = i === rankIdx;
                  const isLocked = i > rankIdx;

                  return (
                    <div
                      key={tier.name}
                      className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all ${
                        isPassed
                          ? "bg-violet-950/50 text-violet-400 border border-violet-500/30"
                          : isCurrent
                          ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20"
                          : "bg-slate-800/30 text-slate-500 border border-dashed border-slate-700"
                      }`}
                    >
                      {isPassed && <span>{tier.name}</span>}
                      {isCurrent && <span>{tier.name}</span>}
                      {isLocked && (
                        <div className="flex flex-col items-center gap-0.5" title={`Unlocks at Level ${tier.unlockLevel}`}>
                          <Lock className="w-2.5 h-2.5 opacity-50" />
                          <span className="text-[7.5px] opacity-70">Lvl {tier.unlockLevel}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Certificate Generator Button */}
              <button
                onClick={() => setShowCert(true)}
                className="mt-6 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow-lg shadow-violet-500/20"
              >
                <Award className="w-4 h-4" /> View My Certificate
              </button>
            </Card>

            {/* GLOBAL LEADERBOARD */}
            <Card className="bg-slate-900 border-white/5 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" /> KindBite Top 10
                </h3>
              </div>

              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-4">No leaders found yet.</p>
                ) : (
                  leaderboard.map((hero, index) => {
                    const isUser = hero.id === user?.uid;
                    const heroLevel = Math.floor((hero.kindPoints || 0) / 300) + 1;
                    return (
                      <div
                        key={hero.id}
                        className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                          isUser
                            ? "bg-violet-950/50 border border-violet-500/30 shadow-inner"
                            : "hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-center font-black text-sm ${
                            index === 0 ? "text-yellow-500" : index === 1 ? "text-slate-300" : index === 2 ? "text-amber-600" : "text-slate-600"
                          }`}>
                            {index === 0 ? <LeaderboardMedal color="yellow" /> :
                             index === 1 ? <LeaderboardMedal color="slate" />  :
                             index === 2 ? <LeaderboardMedal color="amber" />  :
                             `#${index + 1}`}
                          </span>
                          <Avatar 
                            className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate(`/user/${hero.id}`)}
                            title="View public profile"
                          >
                            <AvatarImage src={hero.photoURL} />
                            <AvatarFallback className="text-[10px] text-slate-400 font-bold">
                              {hero.fullName?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p 
                              onClick={() => navigate(`/user/${hero.id}`)}
                              className={`text-sm font-bold truncate max-w-[100px] sm:max-w-[120px] cursor-pointer hover:underline transition-colors ${isUser ? "text-violet-300 hover:text-violet-200" : "text-slate-200 hover:text-white"}`}
                              title="View public profile"
                            >
                              {isUser ? "You" : hero.fullName || "Anonymous"}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase">Level {heroLevel}</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-white">
                          {(hero.kindPoints || 0).toLocaleString()}{" "}
                          <span className="text-[9px] text-violet-400">KP</span>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── CERTIFICATE MODAL OVERLAY ── */}
      {showCert && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
          
          {/* Close Button */}
          <button 
            onClick={() => setShowCert(false)} 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X className="w-6 h-6" />
          </button>

          {/* The Certificate UI (This specific container is captured by html2canvas) */}
          <div 
            ref={certRef}
            className="relative w-full max-w-3xl aspect-[1.414/1] bg-slate-950 flex flex-col items-center justify-center overflow-hidden shadow-2xl p-8 sm:p-12"
          >
            {/* Decorative background elements inside certificate */}
            <div className="absolute top-0 left-0 w-full h-full border-[12px] border-violet-900/30 rounded-xl pointer-events-none" />
            <div className="absolute inset-4 border border-dashed border-violet-500/50 rounded-lg pointer-events-none" />

            {/* Logo / Header */}
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.15)] shrink-0 border-2 border-slate-100 overflow-hidden">
                <div 
                  style={{ 
                    width: '48px', 
                    height: '48px', 
                    backgroundImage: 'url("/logo.png")',
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }} 
                />
              </div>
              <h2 className="text-3xl font-black tracking-widest text-white uppercase">KindBite</h2>
            </div>

            <p className="text-sm font-bold text-violet-400 uppercase tracking-[0.3em] mb-2 relative z-10">Certificate of Impact</p>
            
            <h1 className="text-4xl sm:text-5xl font-black text-slate-50 text-center mb-8 relative z-10">
              {profile?.fullName || "Hero"}
            </h1>

            <p className="text-slate-400 text-center max-w-lg mb-8 leading-relaxed text-sm sm:text-base relative z-10">
              In recognition of your outstanding dedication to reducing food waste, sharing with the community, and protecting our environment. You have achieved the prestigious rank of <strong className="text-violet-400">{currentRank.name} (Level {level})</strong>.
            </p>

            {/* Stats Row inside Certificate */}
            <div className="flex items-center justify-center gap-4 sm:gap-8 mb-10 w-full relative z-10">
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{gotQty}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Meals Rescued</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-black text-amber-400">{givenQty}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Meals Shared</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-black text-sky-400">{((givenQty + gotQty) * 1.25).toFixed(1)}kg</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">CO₂ Avoided</p>
              </div>
            </div>

            {/* Footer Signatures */}
            <div className="flex w-full justify-between items-end px-12 mt-auto relative z-10">
              <div className="text-center">
                <div className="w-32 border-b border-white/20 pb-2 mb-2">
                  <span className="text-xl text-slate-300 italic" style={{ fontFamily: "'Brush Script MT', cursive" }}>KindBite Team</span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Authorized Signature</p>
              </div>
              <div className="text-center">
                <div className="w-32 border-b border-white/20 pb-2 mb-2">
                  <span className="font-bold text-slate-300">{new Date().toLocaleDateString()}</span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Date Awarded</p>
              </div>
            </div>
          </div>

          {/* Download Action */}
          <button
            onClick={downloadCertificate}
            disabled={isDownloading}
            className="mt-8 px-8 py-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white transition-all flex items-center justify-center gap-2 font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {isDownloading ? "Generating..." : "Download as Image"}
          </button>
        </div>
      )}
    </div>
  );
}