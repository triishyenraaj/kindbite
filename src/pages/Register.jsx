import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { registerUser } from "@/services/firebase/auth";
import { createUserProfile } from "@/features/users/userService";
import { auth, db } from "@/services/firebase/config";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";

import { Loader2, ArrowLeft, UserPlus, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);

  // 🛑 NEW: State to control the Success UI and redirection
  const [successConfig, setSuccessConfig] = useState({ 
    show: false, 
    path: "", 
    title: "", 
    subtitle: "" 
  });

  const isEmailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const isPasswordStrong = form.password.length >= 6;
  const passwordsMatch = form.password === form.confirmPassword && form.password.length > 0;
  const isFormValid = isEmailFormatValid && isPasswordStrong && passwordsMatch && form.fullName.length > 2 && emailAvailable === 'available';

  // 🛑 NEW: The Timer Effect for Redirection
  useEffect(() => {
    if (successConfig.show) {
      const timer = setTimeout(() => {
        navigate(successConfig.path);
      }, 2000); // Wait exactly 2 seconds
      
      return () => clearTimeout(timer); // Cleanup timer if component unmounts
    }
  }, [successConfig, navigate]);

  useEffect(() => {
    if (!isEmailFormatValid) {
      setEmailAvailable(null);
      return;
    }

    setEmailAvailable('checking');
    
    const timer = setTimeout(async () => {
      try {
        const q = query(collection(db, "users"), where("email", "==", form.email));
        const snap = await getDocs(q);
        setEmailAvailable(snap.empty ? 'available' : 'taken');
      } catch (e) {
        console.error(e);
        setEmailAvailable(null);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [form.email, isEmailFormatValid]);

  function handleChange(e) {
    let value = e.target.value;
    
    if (e.target.name === "fullName") {
      value = value.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
    }
    
    setForm((prev) => ({
      ...prev,
      [e.target.name]: value,
    }));
    setError(""); 
  }

  // 🛑 UPDATED: Traffic Cop now triggers the Success UI instead of navigating immediately
  async function routeUser(user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      await createUserProfile(user, {
        fullName: user.displayName || "KindBite User",
        email: user.email,
        role: "user",
        profileCompleted: false,
      });
      setSuccessConfig({
        show: true,
        path: "/onboarding",
        title: "Account Created!",
        subtitle: "Redirecting you to setup your profile..."
      });
    } else {
      const data = userDocSnap.data();
      if (data.role === "admin") {
        setSuccessConfig({ show: true, path: "/admin/dashboard", title: "Welcome Back Admin!", subtitle: "Redirecting to dashboard..." });
      } else if (!data.profileCompleted) {
        setSuccessConfig({ show: true, path: "/onboarding", title: "Welcome Back!", subtitle: "Let's finish your profile..." });
      } else {
        setSuccessConfig({ show: true, path: "/donations", title: "Welcome Back!", subtitle: "Redirecting to your donations..." });
      }
    }
  }

  async function handleGoogleSignUp() {
    try {
      setLoading(true);
      setError("");
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await routeUser(result.user);
    } catch (err) {
      console.error(err);
      setError("Google sign-up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // 🛑 UPDATED: Email Submit now triggers the Success UI
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isFormValid) return;

    try {
      setLoading(true);
      const user = await registerUser(form.email, form.password);

      await createUserProfile(user, {
        fullName: form.fullName,
        email: form.email,
        role: "user",
        profileCompleted: false,
      });

      setSuccessConfig({
        show: true,
        path: "/onboarding",
        title: "Account Created!",
        subtitle: "Redirecting you to setup your profile..."
      });
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use. Try logging in instead.");
      } else {
        setError(err.message || "Registration failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 space-y-8">
      
      {!successConfig.show && (
        <Button 
          variant="ghost" 
          onClick={() => navigate("/")} 
          className="text-slate-500 hover:text-violet-600 -ml-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Home
        </Button>
      )}

      <div className="text-center space-y-3">
        <img src={logo} alt="KindBite" className="h-20 w-auto mx-auto mb-2" />
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          {successConfig.show ? "Success" : "Create Account"}
        </h2>
        <p className="text-slate-500">
          {successConfig.show ? "You're all set!" : "Join our mission to rescue food"}
        </p>
      </div>

      <Card className="rounded-[2.5rem] border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden bg-white p-0 gap-0">
        
        {/* 🛑 NEW: Conditional Rendering for the Success UI */}
        {successConfig.show ? (
          <CardContent className="px-8 py-16 flex flex-col items-center justify-center space-y-6 text-center h-[500px]">
            <div className="h-24 w-24 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">{successConfig.title}</h3>
              <p className="text-slate-500 text-lg">{successConfig.subtitle}</p>
            </div>
            <Loader2 className="w-8 h-8 text-violet-600 animate-spin mt-8 opacity-50" />
          </CardContent>
        ) : (
          <>
            <CardHeader className="bg-violet-50/60 border-b border-violet-100 p-0 m-0">
              <div className="px-8 py-10 text-center space-y-2">
                <CardTitle className="text-2xl text-violet-900 font-bold">Sign Up</CardTitle>
                <CardDescription className="text-slate-600 text-base">Start using KindBite today</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-8 pt-10 pb-12">
              <form onSubmit={handleSubmit} className="space-y-5">
                
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="font-semibold text-slate-700 ml-1">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Triishyen Raaj"
                    value={form.fullName}
                    onChange={handleChange}
                    className="h-13 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 border-slate-200 px-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-semibold text-slate-700 ml-1">Email Address</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={handleChange}
                      className={`h-13 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 px-4 pr-10 transition-colors ${
                        (form.email.length > 0 && !isEmailFormatValid) || emailAvailable === 'taken' ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                      }`}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {emailAvailable === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                      {emailAvailable === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {emailAvailable === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                  {form.email.length > 0 && !isEmailFormatValid && (
                    <p className="text-xs text-red-500 ml-2 mt-1 font-medium">Please enter a valid email format.</p>
                  )}
                  {emailAvailable === 'taken' && (
                    <p className="text-xs text-red-500 ml-2 mt-1 font-medium">This email is already registered.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="font-semibold text-slate-700 ml-1">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={form.password}
                      onChange={handleChange}
                      className={`h-13 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 px-4 pr-12 transition-colors ${
                        form.password.length > 0 && !isPasswordStrong ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {form.password.length > 0 && !isPasswordStrong && (
                    <p className="text-xs text-red-500 ml-2 mt-1 font-medium">Password must be at least 6 characters.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-semibold text-slate-700 ml-1">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className={`h-13 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 px-4 transition-colors ${
                      form.confirmPassword.length > 0 && !passwordsMatch ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                    }`}
                  />
                  {form.confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-red-500 ml-2 mt-1 font-medium">Passwords do not match.</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-4 rounded-2xl border border-red-100 font-medium">
                    {error}
                  </div>
                )}

                <p className="text-xs text-slate-500 text-center px-2">
                  By registering, you agree to our{" "}
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-violet-600 hover:underline font-medium cursor-pointer">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-violet-600 hover:underline font-medium cursor-pointer">Privacy Policy</a>.
                </p>

                <Button 
                  type="submit" 
                  className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-violet-200 transition-all active:scale-[0.98] mt-2 disabled:opacity-50 disabled:active:scale-100" 
                  disabled={loading || !isFormValid}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating Account...</>
                  ) : (
                    <><UserPlus className="mr-2 h-5 w-5" /> Register Now</>
                  )}
                </Button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 text-slate-400 font-medium">or</span></div>
                </div>

                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleGoogleSignUp}
                  className="w-full h-14 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-base transition-all active:scale-[0.98]" 
                  disabled={loading}
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

                <p className="text-center text-sm text-slate-600">
                  Already have an account?{" "}
                  <Link to="/login" className="font-bold text-violet-600 hover:underline underline-offset-4 decoration-2">
                    Login here
                  </Link>
                </p>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}