import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Utensils, 
  MapPin, 
  HandPlatter, 
  ArrowRight, 
  Heart, 
  Sparkles,
  Loader2,
  Mail
} from "lucide-react";

// --- CUSTOM ANIMATION COMPONENT ---
// Creates a smooth "count up" effect for the impact numbers
const AnimatedCounter = ({ value, duration = 1500 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // Easing function (easeOutExpo) for a fast start and slow finish
      const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
      
      setCount(Math.floor(value * ease));

      if (percentage < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    if (value > 0) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      setCount(0);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
};

export default function Home() {
  const { user } = useAuth();
  
  // --- REAL METRICS STATE ---
  const [impactStats, setImpactStats] = useState({
    mealsShared: 0,
    activeUsers: 0,
    foodSavedKg: 0,
    livesTouched: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Fetch aggregated data from your analytics document
  useEffect(() => {
    async function fetchRealMetrics() {
      try {
        const snap = await getDoc(doc(db, "analytics", "dashboard_chart"));
        if (snap.exists()) {
          const data = snap.data().impact || {};
          setImpactStats({
            mealsShared: data.totalMeals || 0,
            activeUsers: data.totalRegisteredUsers || 0,
            foodSavedKg: data.wastePreventedKg || 0,
            livesTouched: data.uniquePeople || 0
          });
        }
      } catch (error) {
        console.error("Failed to load impact stats for homepage:", error);
      } finally {
        setIsLoadingStats(false);
      }
    }
    
    fetchRealMetrics();
  }, []);

  return (
    <div className="relative overflow-hidden -mt-4 pb-12 flex flex-col min-h-screen">
      {/* Abstract Professional Purple Background Blobs */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <div className="absolute top-0 left-4 w-48 h-48 bg-violet-400 rounded-full blur-3xl"></div>
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-fuchsia-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-1/3 w-56 h-56 bg-purple-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 space-y-16 pt-8 px-2 flex-grow">
        
        {/* --- HERO SECTION --- */}
        <section className="text-center space-y-6 px-4 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100/80 backdrop-blur border border-violet-200 text-violet-700 text-sm font-semibold mb-2 shadow-sm">
            <Sparkles className="w-4 h-4" /> Powered by Smart Matching Algorithm
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Share Food. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
              Fight Hunger.
            </span>
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            A smart food rescue and donation management system connecting donors with people in need efficiently.
          </p>

          {!user ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button asChild size="lg" className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 h-14 px-8 rounded-full shadow-lg shadow-violet-500/25 text-base text-white transition-all">
                <Link to="/register">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 rounded-full bg-white/80 backdrop-blur border-violet-200 text-violet-700 hover:bg-violet-50 text-base transition-all">
                <Link to="/login">Login</Link>
              </Button>
            </div>
          ) : (
            <div className="pt-4">
              <Button asChild size="lg" className="bg-violet-600 hover:bg-violet-700 h-14 px-8 rounded-full shadow-lg shadow-violet-500/25 text-base text-white w-full sm:w-auto transition-all">
                <Link to="/donations">Go to Feed <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </div>
          )}
        </section>

        {/* --- HOW IT WORKS SECTION --- */}
        <section className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">
            Core Features
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            <Card className="rounded-3xl border border-white/40 shadow-sm bg-white/80 backdrop-blur hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <CardContent className="p-6 text-center space-y-3">
                <div className="mx-auto w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 shadow-inner">
                  <Utensils className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Donate Food</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Post surplus food easily for nearby recipients to claim.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-white/40 shadow-sm bg-white/80 backdrop-blur hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <CardContent className="p-6 text-center space-y-3">
                <div className="mx-auto w-14 h-14 bg-fuchsia-100 rounded-full flex items-center justify-center text-fuchsia-600 shadow-inner">
                  <HandPlatter className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Request Food</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Submit specific food needs to the community.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-white/40 shadow-sm bg-white/80 backdrop-blur hover:shadow-md hover:-translate-y-1 transition-all duration-300 sm:col-span-2 md:col-span-1">
              <CardContent className="p-6 text-center space-y-3">
                <div className="mx-auto w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 shadow-inner">
                  <MapPin className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Smart Match</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Get matched based on location, radius, and dietary needs.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* --- IMPACT STATS SECTION (Now Live!) --- */}
        <section className="bg-gradient-to-br from-violet-600 to-purple-700 text-white py-12 rounded-[2rem] mx-2 shadow-xl border border-violet-400/30">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-10 text-violet-50 flex items-center justify-center gap-2">
              <Heart className="w-6 h-6 text-fuchsia-300 fill-fuchsia-300" /> Community Impact
            </h2>
            
            {isLoadingStats ? (
              <div className="flex justify-center items-center h-24">
                <Loader2 className="w-8 h-8 animate-spin text-fuchsia-300" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-4">
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold tracking-tight text-white flex justify-center">
                    <AnimatedCounter value={impactStats.mealsShared} />
                  </div>
                  <div className="text-violet-200 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Meals Shared</div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold tracking-tight text-white flex justify-center">
                    <AnimatedCounter value={impactStats.activeUsers} />
                  </div>
                  <div className="text-violet-200 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Registered Users</div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold tracking-tight text-fuchsia-300 flex justify-center">
                    <AnimatedCounter value={impactStats.foodSavedKg} />
                  </div>
                  <div className="text-violet-200 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Kg Food Saved</div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold tracking-tight text-fuchsia-300 flex justify-center">
                    <AnimatedCounter value={impactStats.livesTouched} />
                  </div>
                  <div className="text-violet-200 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Lives Touched</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* --- HELPDESK SECTION --- */}
        <section className="text-center pt-8 pb-4">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Need Help?</h3>
          <p className="text-sm text-slate-600 mb-4">If you face any problems, feel free to contact our support team.</p>
          <Button asChild variant="outline" className="rounded-full border-violet-200 text-violet-700 hover:bg-violet-50 bg-white/80 backdrop-blur shadow-sm transition-all">
            <a href="mailto:kindbite@gmail.com">
              <Mail className="w-4 h-4 mr-2" />
              Contact Helpdesk
            </a>
          </Button>
        </section>

      </div>

      {/* --- MINI FOOTER --- */}
      <footer className="mt-8 text-center pb-6 text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} KindBite. Developed for USM Final Year Project.</p>
      </footer>
    </div>
  );
}