import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { logoutUser } from "@/services/firebase/auth"; 
import { getUserProfile, updateUserProfile } from "@/features/users/userService";
import LocationPicker from "@/features/maps/LocationPicker";
import { FOOD_TAGS, FOOD_TYPES } from "@/utils/foodOptions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, X, Loader2, Sparkles, LogOut } from "lucide-react";

export default function Onboarding() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    latitude: null,
    longitude: null,
    foodTags: [],
    radiusKm: 10,
    quantity: 1,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      if (authLoading) return;
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);
        if (!isMounted) return;
        if (profile?.profileCompleted) {
          navigate("/donations"); 
          return;
        }

        setForm({
          fullName: profile?.fullName || "",
          phone: profile?.phone || "",
          address: profile?.address || "",
          latitude: profile?.latitude || null,
          longitude: profile?.longitude || null,
          foodTags: profile?.preferences?.foodTags || [],
          radiusKm: profile?.preferences?.radiusKm || 10,
          quantity: profile?.preferences?.quantity || 1,
        });
      } catch (err) {
        setError("Failed to load onboarding data.");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
    return () => {
      isMounted = false; 
    };
  }, [user, authLoading, navigate]);

  function toggleFoodTag(option) {
    if (option === "No Restrictions") {
      setForm((prev) => ({
        ...prev,
        foodTags: ["No Restrictions"],
      }));
      return;
    }

    setForm((prev) => {
      const filtered = prev.foodTags.filter((item) => item !== "No Restrictions");
      if (filtered.includes(option)) {
        return {
          ...prev,
          foodTags: filtered.filter((item) => item !== option),
        };
      }
      return {
        ...prev,
        foodTags: [...filtered, option],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // 1. Basic Empty Check
    if (!form.fullName || !form.phone || !form.address) {
      setError("Please fill in your full name, phone number, and address.");
      return;
    }

    // 2. Name Length Check
    if (form.fullName.trim().length < 3) {
      setError("Please enter a valid full name.");
      return;
    }

    // 3. Smart Phone Number Check (Forgiving of spaces and dashes)
    const cleanPhone = form.phone.replace(/[-+ ]/g, ""); // Removes dashes, plus signs, and spaces
    if (cleanPhone.length < 9 || !/^\d+$/.test(cleanPhone)) {
      setError("Please enter a valid phone number (e.g., 011-12345678).");
      return;
    }

    // 4. Map Location Check
    if (!form.latitude || !form.longitude) {
      setError("Please select a valid location from the map dropdown.");
      return;
    }

    // 5. Strict Numbers Check (Catches 0, negatives, and empty inputs)
    const finalRadius = Number(form.radiusKm);
    const finalQuantity = Number(form.quantity);

    if (finalRadius < 1 || finalQuantity < 1) {
      setError("Radius and Typical Pax must be at least 1.");
      return;
    }

    try {
      setSaving(true);

      await updateUserProfile(user.uid, {
        fullName: form.fullName.trim(), // Trim spaces before saving
        phone: form.phone.trim(),
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
        preferences: {
          foodTags: form.foodTags,
          radiusKm: finalRadius,
          quantity: finalQuantity,
        },
        profileCompleted: true,
      });

      const updatedProfile = await getUserProfile(user.uid);

      if (updatedProfile?.profileCompleted) {
        navigate("/donations", { replace: true });
      } else {
        setError("Profile saved, but completion status was not confirmed yet. Please try again.");
      }
    } catch (err) {
      setError("Failed to save onboarding details.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );

  return (
    // RESPONSIVE TRICK 1: max-w-md on mobile, md:max-w-2xl on laptop to give the card breathing room
    <div className="mx-auto max-w-md md:max-w-2xl px-4 py-12 md:py-20 space-y-6 md:space-y-8 min-h-screen flex flex-col justify-center">
      
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-violet-100 rounded-2xl text-violet-600 mb-2 shadow-sm">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Setup Profile</h2>
        <p className="text-slate-500 md:text-lg">Let's personalize KindBite for you</p>
      </div>

      <Card className="rounded-[2.5rem] border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden bg-white p-0 gap-0">
        <CardHeader className="bg-violet-50/60 border-b border-violet-100 p-0 m-0">
          <div className="px-8 py-8 md:py-10 text-center space-y-2">
            <CardTitle className="text-2xl text-violet-900 font-bold">Preferences</CardTitle>
            <CardDescription className="text-slate-600 text-base">
              Add your matching preferences to start.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-6 md:px-10 pt-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* RESPONSIVE TRICK 2: Grid for Name and Phone on Laptop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="font-semibold text-slate-700 ml-1">Full Name</Label>
                {/* FIXED: h-13 to h-12 */}
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="h-12 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 border-slate-200 px-4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="font-semibold text-slate-700 ml-1">Phone Number</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="011-XXXX XXXX"
                  className="h-12 rounded-2xl focus-visible:ring-violet-500 bg-slate-50/50 border-slate-200 px-4"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 ml-1">Default Pickup Location</Label>
              <LocationPicker
                address={form.address}
                lat={form.latitude}
                lng={form.longitude}
                onLocationChange={(loc) =>
                  setForm({ ...form, address: loc.address, latitude: loc.lat, longitude: loc.lng })
                }
              />
            </div>

            {/* RESPONSIVE TRICK 3: Grouping Tags and Numbers on Laptop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="font-semibold text-slate-700 ml-1">Food Preferences</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full h-12 rounded-2xl justify-between font-normal text-slate-500 bg-white border-slate-200 px-4">
                      {form.foodTags.length > 0
                        ? `${form.foodTags.length} option(s) selected`
                        : "Select preferences..."}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-full bg-white z-50 border-slate-200 shadow-lg rounded-2xl max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel className="text-violet-600 font-bold px-4 py-2">Categories</DropdownMenuLabel>
                    {FOOD_TYPES.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option}
                        checked={form.foodTags.includes(option)}
                        onCheckedChange={() => toggleFoodTag(option)}
                        onSelect={(e) => e.preventDefault()}
                        className="rounded-lg mx-1"
                      >
                        {option}
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel className="text-violet-600 font-bold px-4 py-2">Dietary Labels</DropdownMenuLabel>
                    {FOOD_TAGS.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option}
                        checked={form.foodTags.includes(option)}
                        onCheckedChange={() => toggleFoodTag(option)}
                        onSelect={(e) => e.preventDefault()}
                        className="rounded-lg mx-1"
                      >
                        {option}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {form.foodTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 px-1">
                    {form.foodTags.map((option) => (
                      <Badge key={option} variant="secondary" className="bg-violet-50 text-violet-700 hover:bg-violet-100 border-none rounded-lg py-1.5 px-3 flex items-center gap-2">
                        {option}
                        <X className="h-3.5 w-3.5 cursor-pointer opacity-60 hover:opacity-100" onClick={() => toggleFoodTag(option)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="radiusKm" className="font-semibold text-slate-700 ml-1">Radius (km)</Label>
                  <Input
                    id="radiusKm"
                    type="number"
                    min="1"
                    value={form.radiusKm}
                    onChange={(e) => setForm({ ...form, radiusKm: e.target.value })}
                    className="h-12 rounded-2xl bg-slate-50/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity" className="font-semibold text-slate-700 ml-1">Typical Pax</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="h-12 rounded-2xl bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-4 rounded-2xl border border-red-100 font-medium">
                {error}
              </div>
            )}

            {/* Changed mt-2 to mt-8 to give the button a little breathing room from the form */}
            <div className="pt-4">
              <Button
                type="submit"
                className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-violet-200 transition-all active:scale-[0.98]"
                disabled={saving}
              >
                {saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</> : "Complete Profile"}
              </Button>
            </div>
          </form>

          {/* Logout Option */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
             <button 
                onClick={() => { if(window.confirm("Logout and finish setup later?")) logoutUser(); }}
                className="inline-flex items-center text-sm font-semibold text-slate-400 hover:text-red-500 transition-colors"
             >
                <LogOut className="w-4 h-4 mr-2" />
                Logout and finish later
             </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}