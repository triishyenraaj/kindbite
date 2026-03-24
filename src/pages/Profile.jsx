import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { logoutUser } from "@/services/firebase/auth";
import { getUserProfile, updateUserProfile, uploadProfilePicture } from "@/features/users/userService";
import LocationPicker from "@/features/maps/LocationPicker";
import { FOOD_TAGS, FOOD_TYPES } from "@/utils/foodOptions"; 

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Edit2, LogOut, X, Save, ChevronDown, Camera, Loader2, Mail, Phone, MapPin } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
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
    async function loadProfile() {
      if (!user?.uid) return;
      try {
        const data = await getUserProfile(user.uid);
        setProfile(data);
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handleEditClick = () => {
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
    setIsEditing(true);
  };

  const toggleFoodTag = (option) => {
    if (option === "No Restrictions") {
      setForm({ ...form, foodTags: ["No Restrictions"] });
      return;
    }
    setForm((prev) => {
      const filtered = prev.foodTags.filter((item) => item !== "No Restrictions");
      if (filtered.includes(option)) {
        return { ...prev, foodTags: filtered.filter((item) => item !== option) };
      }
      return { ...prev, foodTags: [...filtered, option] };
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user?.uid) return;

    setUploadingImage(true);
    try {
      const newPhotoURL = await uploadProfilePicture(user.uid, file);
      setProfile((prev) => ({ ...prev, photoURL: newPhotoURL }));
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim() || !form.address.trim()) {
    alert("Full Name, Phone, and Address are required to keep your account active.");
    return;
  }
    setSaving(true);
    try {
      const updates = {
        fullName: form.fullName,
        phone: form.phone,
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
        preferences: {
          foodTags: form.foodTags,
          radiusKm: Number(form.radiusKm),
          quantity: Number(form.quantity),
        }
      };
      await updateUserProfile(user.uid, updates);
      setProfile((prev) => ({ ...prev, ...updates }));
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
    </div>
  );

  return (
    <div className="mx-auto max-w-md py-10 px-4">
      <Card className="rounded-[2.5rem] border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden bg-white p-0 gap-0 transition-all">
        
        {/* Header Section */}
        <CardHeader className="bg-violet-50/60 border-b border-violet-100 p-0 m-0">
          <div className="px-8 py-10 flex items-center justify-between">
            <div className="space-y-1 text-left">
              <CardTitle className="text-2xl text-violet-900 font-bold">
                {isEditing ? "Edit Profile" : "My Profile"}
              </CardTitle>
              {!isEditing && <p className="text-sm text-violet-600 font-medium">Manage your identity</p>}
            </div>
            {!isEditing && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEditClick} 
                className="rounded-xl border-violet-200 text-violet-700 bg-white hover:bg-violet-50 h-10 px-4"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>

        {isEditing ? (
          <form onSubmit={handleSave} className="flex flex-col">
            <CardContent className="px-8 pt-10 pb-6 space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <Avatar className="h-28 w-28 border-4 border-white shadow-lg">
                    <AvatarImage src={profile?.photoURL} className="object-cover" />
                    <AvatarFallback className="text-4xl bg-violet-100 text-violet-700 font-bold">
                      {profile?.fullName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <label htmlFor="profile-upload" className="absolute bottom-0 right-0 bg-violet-600 p-2.5 rounded-full text-white cursor-pointer shadow-lg hover:bg-violet-700 transition-all">
                    {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    <input id="profile-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700 ml-1">Full Name</Label>
                <Input value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} required className="h-13 rounded-2xl bg-slate-50/50" />
              </div>
              
              <div className="space-y-2">
                <Label className="font-semibold text-slate-700 ml-1">Phone Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="h-13 rounded-2xl bg-slate-50/50" />
              </div>

              <div className="space-y-2 pb-2">
                <Label className="font-semibold text-slate-700 ml-1">Location</Label>
                <LocationPicker 
                  address={form.address} lat={form.latitude} lng={form.longitude} 
                  onLocationChange={(loc) => setForm({...form, address: loc.address, latitude: loc.lat, longitude: loc.lng })}
                />
              </div>

              <div className="space-y-3 pt-2">
                <Label className="font-semibold text-slate-700 ml-1">Food Preferences</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full h-13 rounded-2xl justify-between font-normal text-slate-500 bg-white border-slate-200">
                      {form.foodTags.length > 0 ? `${form.foodTags.length} selected` : "Select tags..."}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] bg-white z-50 shadow-lg rounded-2xl max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel className="text-violet-600 font-bold px-4 pt-2">Categories</DropdownMenuLabel>
                    {FOOD_TYPES.map((o) => (
                      <DropdownMenuCheckboxItem key={o} checked={form.foodTags.includes(o)} onCheckedChange={() => toggleFoodTag(o)} className="rounded-lg mx-1">{o}</DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-violet-600 font-bold px-4 pt-2">Dietary</DropdownMenuLabel>
                    {FOOD_TAGS.map((o) => (
                      <DropdownMenuCheckboxItem key={o} checked={form.foodTags.includes(o)} onCheckedChange={() => toggleFoodTag(o)} className="rounded-lg mx-1">{o}</DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {form.foodTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {form.foodTags.map((o) => (
                      <Badge key={o} variant="secondary" className="bg-violet-50 text-violet-700 rounded-lg py-1.5 px-3 flex items-center gap-2">
                        {o} <X className="h-3.5 w-3.5 cursor-pointer opacity-60" onClick={() => toggleFoodTag(o)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="ml-1">Radius (km)</Label><Input type="number" min="1" value={form.radiusKm} onChange={(e) => setForm({...form, radiusKm: e.target.value})} className="h-13 rounded-2xl bg-slate-50/50" /></div>
                <div className="space-y-2"><Label className="ml-1">Typical Pax</Label><Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({...form, quantity: e.target.value})} className="h-13 rounded-2xl bg-slate-50/50" /></div>
              </div>
            </CardContent>

            <CardFooter className="grid grid-cols-2 gap-3 pt-6 pb-10 px-8 border-t bg-slate-50/50">
              <Button type="button" variant="outline" className="h-13 rounded-2xl bg-white border-slate-200 font-bold" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-13 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-lg shadow-violet-200" disabled={saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save</>}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="px-8 pt-10 pb-12 space-y-8">
            <div className="flex flex-col items-center">
              <Avatar className="h-32 w-32 border-4 border-violet-50 shadow-xl">
                <AvatarImage src={profile?.photoURL} className="object-cover" />
                <AvatarFallback className="text-4xl bg-violet-100 text-violet-700 font-bold">
                  {profile?.fullName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <h3 className="mt-4 text-2xl font-bold text-slate-900">{profile?.fullName || "New User"}</h3>
              <Badge variant="outline" className="mt-1 bg-slate-50 border-slate-200 text-slate-500 capitalize">{profile?.role || "Member"}</Badge>
            </div>

            <div className="space-y-5">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm">
                <div className="bg-white p-2.5 rounded-xl shadow-sm text-violet-600"><Mail className="w-5 h-5" /></div>
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</p><p className="font-medium text-slate-700">{profile?.email}</p></div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm">
                <div className="bg-white p-2.5 rounded-xl shadow-sm text-emerald-600"><Phone className="w-5 h-5" /></div>
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</p><p className="font-medium text-slate-700">{profile?.phone || "Not set"}</p></div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 transition-colors hover:bg-white hover:shadow-sm">
                <div className="bg-white p-2.5 rounded-xl shadow-sm text-blue-600"><MapPin className="w-5 h-5" /></div>
                <div className="flex-1"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address</p><p className="font-medium text-slate-700 leading-tight">{profile?.address || "Not set"}</p></div>
              </div>

              <div className="bg-violet-600 rounded-[2rem] p-6 shadow-lg shadow-violet-200 relative overflow-hidden group">
                <SparkleIcon className="absolute top-0 right-0 w-24 h-24 text-white/10 -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mb-3">Matching Preferences</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {profile?.preferences?.foodTags?.length > 0 ? (
                    profile.preferences.foodTags.map(tag => (
                      <Badge key={tag} className="bg-white/20 text-white border-none backdrop-blur-md rounded-lg py-1 px-3">{tag}</Badge>
                    ))
                  ) : (<span className="text-white/60 italic text-sm">No restrictions set</span>)}
                </div>
                <div className="flex gap-6 text-xs text-violet-100 font-bold border-t border-white/10 pt-4">
                  <p>RADIUS: <span className="text-white">{profile?.preferences?.radiusKm || 10} KM</span></p>
                  <p>PAX: <span className="text-white">{profile?.preferences?.quantity || 1} PEOPLE</span></p>
                </div>
              </div>

              <div className="pt-4 px-2">
                <Button 
                  variant="ghost" 
                  className="w-full h-14 rounded-2xl text-red-500 hover:text-red-600 hover:bg-red-50 font-bold transition-all" 
                  onClick={() => { if(window.confirm("Are you sure you want to logout?")) logoutUser(); }}
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Logout Account
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function SparkleIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2L14.5 9H21L15.5 13.5L18 21L12 16.5L6 21L8.5 13.5L3 9H9.5L12 2Z" />
    </svg>
  );
}