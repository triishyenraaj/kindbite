import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginUser } from "@/services/firebase/auth";

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase/config";
import { GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signOut } from "firebase/auth"; // 🛑 NEW: Imported signOut

// 🛑 NEW: Imported our new notification bouncer!
import { requestNotificationPermission } from "@/features/users/userService";

import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react"; 
import logo from "@/assets/logo.png"; 

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [resetMsg, setResetMsg] = useState({ type: "", text: "" });

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const isPasswordValid = form.password.length >= 6;
  const isFormValid = isEmailValid && isPasswordValid;

  function handleChange(e) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError("");
    setResetMsg({ type: "", text: "" });
  }

  // The Traffic Cop Helper Function
  async function routeUser(uid) {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      
      // 🛑 THE LOGIN BOUNCER: Check if suspended!
      if (userData.status === "suspended") {
        await signOut(auth); // Force them back out
        setError("Your account has been suspended. Please contact admin support.");
        return; // Stop the routing process completely
      }
      
      if (userData.role === "admin") {
        navigate("/admin/dashboard"); 
      } else if (!userData.profileCompleted) {
        navigate("/onboarding"); 
      } else {
        navigate("/donations"); 
      }
    } else {
      navigate("/onboarding");
    }
  }

  async function handleForgotPassword() {
    if (!isEmailValid) {
      setResetMsg({ type: "error", text: "Please enter a valid email address first." });
      return;
    }
    
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, form.email);
      setResetMsg({ type: "success", text: "Password reset link sent to your email!" });
    } catch (err) {
      console.error(err);
      setResetMsg({ type: "error", text: "Failed to send reset email. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setError("");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      
      // 🛑 NEW: Ask for Notification Permission (runs in background)
      requestNotificationPermission(auth.currentUser.uid);

      await routeUser(auth.currentUser.uid);
    } catch (err) {
      console.error(err);
      setError("Google sign-in failed. Please try again.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResetMsg({ type: "", text: "" });

    if (!isFormValid) return;

    try {
      setLoading(true);
      await loginUser(form.email, form.password);
      
      // 🛑 NEW: Ask for Notification Permission (runs in background)
      requestNotificationPermission(auth.currentUser.uid);

      await routeUser(auth.currentUser.uid);
    } catch (err) {
      console.error(err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 space-y-8">
      
      <Button 
        variant="ghost" 
        onClick={() => navigate("/")} 
        className="text-slate-500 hover:text-violet-600 -ml-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Home
      </Button>

      <div className="text-center space-y-3">
        <img src={logo} alt="KindBite" className="h-20 w-auto mx-auto mb-2" />
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome Back</h2>
        <p className="text-slate-500">Sign in to start rescuing food</p>
      </div>

      <Card className="rounded-[2.5rem] border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden bg-white p-0 gap-0">
        
        <CardHeader className="bg-violet-50/60 border-b border-violet-100 p-0 m-0">
          <div className="px-8 py-10 text-center space-y-2">
            <CardTitle className="text-2xl text-violet-900 font-bold">Login to KindBite</CardTitle>
            <CardDescription className="text-slate-600 text-base">Enter your credentials to continue</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-8 pt-10 pb-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold text-slate-700 ml-1">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoFocus
                placeholder="triishyen@usm.my"
                value={form.email}
                onChange={handleChange}
                className={`h-13 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 px-4 transition-colors ${
                  form.email.length > 0 && !isEmailValid ? "border-red-300 bg-red-50/50" : "border-slate-200"
                }`}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1 pr-1">
                <Label htmlFor="password" name="password" className="font-semibold text-slate-700">Password</Label>
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  className="h-13 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 border-slate-200 px-4 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-4 rounded-2xl border border-red-100 font-medium">
                {error}
              </div>
            )}

            {resetMsg.text && (
              <div className={`text-sm p-4 rounded-2xl border font-medium ${
                resetMsg.type === "error" 
                  ? "bg-red-50 text-red-600 border-red-100" 
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}>
                {resetMsg.text}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-violet-200 transition-all active:scale-[0.98] mt-2 disabled:opacity-50 disabled:active:scale-100" 
              disabled={loading || !isFormValid}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Signing in...</>
              ) : (
                "Login"
              )}
            </Button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 text-slate-400 font-medium">or</span></div>
            </div>

            <Button 
              type="button" 
              variant="outline"
              onClick={handleGoogleLogin}
              className="w-full h-14 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-base transition-all active:scale-[0.98]" 
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Continue with Google
            </Button>

            <p className="text-center text-sm text-slate-600 pt-2">
              Don't have an account?{" "}
              <Link to="/register" className="font-bold text-violet-600 hover:underline underline-offset-4 decoration-2 transition-all">
                Join KindBite
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}