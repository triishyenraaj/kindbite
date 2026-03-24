import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginUser } from "@/services/firebase/auth";
import { Loader2, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png"; 

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);
      await loginUser(form.email, form.password);
      navigate("/donations"); 
    } catch (err) {
      console.error(err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 space-y-8">
      
      {/* Back Button */}
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

      {/* Added p-0 and gap-0 because Choice A removed them from base, ensuring flush edges */}
      <Card className="rounded-[2.5rem] border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden bg-white p-0 gap-0">
        
        {/* Header: Manual py-10 for that tall, clean purple area */}
        <CardHeader className="bg-violet-50/60 border-b border-violet-100 p-0 m-0">
          <div className="px-8 py-10 text-center space-y-2">
            <CardTitle className="text-2xl text-violet-900 font-bold">Login to KindBite</CardTitle>
            <CardDescription className="text-slate-600 text-base">Enter your credentials to continue</CardDescription>
          </div>
        </CardHeader>

        {/* Content: Manual pb-12 so the bottom isn't cramped */}
        <CardContent className="px-8 pt-10 pb-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold text-slate-700 ml-1">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="triishyen@usm.my"
                value={form.email}
                onChange={handleChange}
                className="h-13 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 border-slate-200 px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" name="password" className="font-semibold text-slate-700 ml-1">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                className="h-13 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 border-slate-200 px-4"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-4 rounded-2xl border border-red-100 font-medium">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-violet-200 transition-all active:scale-[0.98] mt-2" 
              disabled={loading}
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

            <p className="text-center text-sm text-slate-600">
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