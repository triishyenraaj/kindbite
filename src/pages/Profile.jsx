import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom"; 
import { useAuth } from "@/features/auth/useAuth";
import { logoutUser } from "@/services/firebase/auth";
import { updateUserProfile, uploadProfilePicture, removeNotificationToken, syncKindPoints } from "@/features/users/userService";
import LocationPicker from "@/features/maps/LocationPicker";
import { FOOD_TAGS, FOOD_TYPES } from "@/utils/foodOptions"; 

import Cropper from 'react-easy-crop'; // 🌟 NEW: Added cropper library

// 🌟 MODIFIED: Swapped static fetches for onSnapshot
import { query, collection, where, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/services/firebase/config"; 

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"; // 🌟 NEW: For the cropper modal
import { Slider } from "@/components/ui/slider"; // 🌟 NEW: For zoom control
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Edit2, LogOut, X, Save, ChevronDown, Camera, Loader2, Mail, Phone, MapPin, Star, ChevronRight, Leaf, Recycle, Sparkles, Flame, Trophy, HeartPulse, Banknote, HandPlatter, ShoppingBag, Users, AlertOctagon, PackageCheck, Crown, ZoomIn } from "lucide-react"; 

const RANKS = ["Seed", "Sprout", "Hero", "Guardian", "Legend"];

// --- 🌟 UTILITY FUNCTIONS FOR CROPPING ---
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, 'image/jpeg');
  });
}
// --- END UTILITY FUNCTIONS ---

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate(); 
  
  const [profile, setProfile] = useState(null);
  
  // 🚨 FIX 1: Added positiveCount to state
  const [reputation, setReputation] = useState({ average: 0, total: 0, positiveCount: 0 });
  
  // 🌟 NEW: Live quantities tracked by snapshot listeners
  const [givenQty, setGivenQty] = useState(0);
  const [gotQty, setGotQty] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // 🌟 NEW: Image Cropper States
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // 🚨 FIX 4: Safety buffer to prevent race conditions during DB sync
  const [syncReady, setSyncReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSyncReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  
  const [form, setForm] = useState({
    fullName: "", phone: "", address: "", latitude: null, longitude: null,
    foodTags: [], radiusKm: 10, quantity: 1,
  });

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    // 1. REAL-TIME PROFILE LISTENER
    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) setProfile({ id: docSnap.id, ...docSnap.data() });
      setLoading(false);
    });

    // 2. REAL-TIME REPUTATION LISTENER (Filters out Admin-Hidden Reviews!)
    const qReviews = query(collection(db, "reviews"), where("revieweeId", "==", user.uid));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const visibleReviews = snap.docs.map(d => d.data()).filter(r => !r.isHidden);
      if (visibleReviews.length > 0) {
        const totalScore = visibleReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
        
        // 🚨 FIX 2: Calculate how many reviews are positive (4 or 5 stars)
        const positiveCount = visibleReviews.filter(r => Number(r.rating) >= 4).length; 

        setReputation({
          average: (totalScore / visibleReviews.length).toFixed(1),
          total: visibleReviews.length,
          positiveCount: positiveCount // Store it here!
        });
      } else {
        setReputation({ average: 0, total: 0, positiveCount: 0 });
      }
    });

    // 3. REAL-TIME IMPACT LISTENERS (Donations & Requests)
    let gaveDon = 0, gaveReq = 0, gotDon = 0, gotReq = 0;
    
    const updateImpact = () => {
      setGivenQty(gaveDon + gaveReq);
      setGotQty(gotDon + gotReq);
    };

    const unsubGaveDon = onSnapshot(query(collection(db, "donations"), where("donorId", "==", user.uid), where("status", "==", "completed")), snap => {
      gaveDon = 0; snap.forEach(d => gaveDon += Number(d.data().quantity || 0)); updateImpact();
    });
    const unsubGaveReq = onSnapshot(query(collection(db, "requests"), where("donorId", "==", user.uid), where("status", "==", "completed")), snap => {
      gaveReq = 0; snap.forEach(d => gaveReq += Number(d.data().quantity || 0)); updateImpact();
    });
    const unsubGotDon = onSnapshot(query(collection(db, "donations"), where("recipientId", "==", user.uid), where("status", "==", "completed")), snap => {
      gotDon = 0; snap.forEach(d => gotDon += Number(d.data().quantity || 0)); updateImpact();
    });
    const unsubGotReq = onSnapshot(query(collection(db, "requests"), where("requesterId", "==", user.uid), where("status", "==", "completed")), snap => {
      gotReq = 0; snap.forEach(d => gotReq += Number(d.data().quantity || 0)); updateImpact();
    });

    return () => {
      unsubProfile();
      unsubReviews();
      unsubGaveDon();
      unsubGaveReq();
      unsubGotDon();
      unsubGotReq();
    };
  }, [user?.uid]);

  // 🌟 DYNAMIC CALCULATIONS: React auto-calculates this instantly if any data above changes
  const personalImpact = useMemo(() => {
    const combined = givenQty + gotQty;
    return {
      mealsGiven: givenQty,
      mealsRescued: gotQty,
      co2Saved: combined * 1.25,
      wastePrevented: combined * 0.5,
      totalFoodSaved: combined,          
      economicValue: combined * 10     
    };
  }, [givenQty, gotQty]);

  // 🚨 FIX 3: Fully synced with Sanctuary logic & Reputation Trap removed
  const heroStats = useMemo(() => {
    const calculatedPoints = (givenQty * 15) + (gotQty * 5) + (reputation.positiveCount * 10);
    const calculatedLevel = Math.floor(calculatedPoints / 300) + 1;
    
    const RANK_TIERS = [
      { name: "Seed",     unlockLevel: 1 },
      { name: "Sprout",   unlockLevel: 3 },
      { name: "Hero",     unlockLevel: 6 },
      { name: "Guardian", unlockLevel: 10 },
      { name: "Legend",   unlockLevel: 15 },
    ];

    let currentRank = RANK_TIERS[0].name;
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (calculatedLevel >= RANK_TIERS[i].unlockLevel) {
        currentRank = RANK_TIERS[i].name;
        break;
      }
    }

    return {
      points: calculatedPoints,
      level: calculatedLevel,
      rank: currentRank
    };
  }, [givenQty, gotQty, reputation.positiveCount]);

  // 🌟 REAL-TIME BACKGROUND SYNC: Keeps database Kind Points updated
  // 🚨 FIX 4: Safe Background Sync (Requires syncReady to be true)
  useEffect(() => {
    if (syncReady && profile && user?.uid && heroStats.points !== undefined) {
      if (profile.kindPoints !== heroStats.points) {
        syncKindPoints(user.uid, heroStats.points).catch(err => console.error("Background sync failed:", err));
      }
    }
  }, [heroStats.points, profile?.kindPoints, user?.uid, profile, syncReady]);

  const getMotivationalSentence = () => {
    const total = personalImpact.mealsGiven + personalImpact.mealsRescued;
    if (total === 0) return "Plant your first seed by completing a food rescue today!";
    if (total >= 50) return `Incredible! You've directly provided ${total} meals to neighbors in need, proving that real heroes don't wear capes.`;
    return `Every meal matters. Your actions have directly saved ${total} portions of food and built a stronger, kinder community.`;
  };

  const handleEditClick = () => {
    setForm({
      fullName: profile?.fullName || "", phone: profile?.phone || "", address: profile?.address || "",
      latitude: profile?.latitude || null, longitude: profile?.longitude || null,
      foodTags: profile?.preferences?.foodTags || [], radiusKm: profile?.preferences?.radiusKm || 10, quantity: profile?.preferences?.quantity || 1,
    });
    setIsEditing(true);
  };

  const toggleFoodTag = (option) => {
    if (option === "No Restrictions") return setForm({ ...form, foodTags: ["No Restrictions"] });
    setForm((prev) => {
      const filtered = prev.foodTags.filter((item) => item !== "No Restrictions");
      if (filtered.includes(option)) return { ...prev, foodTags: filtered.filter((item) => item !== option) };
      return { ...prev, foodTags: [...filtered, option] };
    });
  };

  // 🌟 NEW: Handles file selection and opens the cropper modal
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return alert("Please upload an image file.");
    
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageToCrop(reader.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setIsCropModalOpen(true);
    });
    reader.readAsDataURL(file);
    e.target.value = null; // Reset input
  };

  // 🌟 NEW: Updates crop coordinates when user moves the image
  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // 🌟 MODIFIED: Generates cropped image and uploads it
  const handleSaveCroppedImage = async () => {
    if (!user?.uid || !imageToCrop || !croppedAreaPixels) return;
    
    setUploadingImage(true);
    setIsCropModalOpen(false);
    
    try {
      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const finalFile = new File([croppedImageBlob], `profile_${user.uid}.jpg`, { type: 'image/jpeg' });
      await uploadProfilePicture(user.uid, finalFile);
      setImageToCrop(null);
    } catch (error) {
      console.error("Error cropping/uploading image:", error);
      alert("Failed to process profile picture. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim() || !form.address.trim()) return alert("Full Name, Phone, and Address are required.");
    setSaving(true);
    try {
      const updates = {
        fullName: form.fullName, phone: form.phone, address: form.address, latitude: form.latitude, longitude: form.longitude,
        preferences: { foodTags: form.foodTags, radiusKm: Number(form.radiusKm), quantity: Number(form.quantity) }
      };
      await updateUserProfile(user.uid, updates);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSecureLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        if (user?.uid) await removeNotificationToken(user.uid);
        await logoutUser(); 
      } catch (error) {
        console.error("Error during logout:", error);
      }
    }
  };

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>;

  return (
    <div className={`mx-auto ${isEditing ? 'max-w-xl' : 'max-w-5xl'} py-10 px-4 transition-all duration-300`}>
      
      {/* 🌟 NEW: Cropper Modal (FIXED BUTTON CUTOFF) */}
      <Dialog open={isCropModalOpen} onOpenChange={setIsCropModalOpen}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[85vh] rounded-[2rem] p-0 overflow-hidden bg-white z-[100] flex flex-col">
          
          <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <DialogTitle className="text-xl font-bold text-slate-900">Adjust Profile Picture</DialogTitle>
            <DialogDescription className="hidden">Crop and adjust your profile picture.</DialogDescription>
          </DialogHeader>
          
          {/* THE FIX: Added min-h-0 here so it shrinks properly and stops pushing the footer out */}
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            
            <div className="relative w-full h-[40vh] min-h-[250px] max-h-[350px] bg-slate-900 rounded-2xl overflow-hidden shadow-inner mb-5">
              {imageToCrop && (
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1} 
                  cropShape="round" 
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <ZoomIn className="w-4 h-4 text-violet-500" /> Zoom Controls
                </Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[zoom]}
                    min={1}
                    max={3}
                    step={0.1}
                    onValueChange={(value) => setZoom(value[0])}
                    className="flex-1"
                  />
                  <span className="font-mono text-sm text-slate-600 w-12 text-right">{zoom.toFixed(1)}x</span>
                </div>
                <p className="text-xs text-slate-500 italic text-center pt-1">Drag the image to center your face.</p>
            </div>
          </div>

          {/* THE FIX: Replaced DialogFooter with standard div to prevent shadcn class conflicts, added strict pb-6 */}
          <div className="px-6 pt-5 pb-6 border-t border-slate-100 bg-slate-50/50 grid grid-cols-2 gap-3 shrink-0">
            <Button variant="outline" className="h-11 rounded-xl font-bold" onClick={() => setIsCropModalOpen(false)}>
              Cancel
            </Button>
            <Button className="h-11 rounded-xl bg-violet-600 hover:bg-violet-700 font-bold text-white" onClick={handleSaveCroppedImage}>
              Save & Upload
            </Button>
          </div>
          
        </DialogContent>
      </Dialog>

      {isEditing ? (
        <Card className="rounded-[2.5rem] border-slate-200 shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-violet-50/60 border-b border-violet-100 px-8 py-10 flex flex-row items-center justify-between">
            <div><CardTitle className="text-2xl text-violet-900 font-bold">Edit Profile</CardTitle></div>
          </CardHeader>
          <form onSubmit={handleSave} className="flex flex-col">
            <CardContent className="px-8 pt-10 pb-6 space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <Avatar className="h-28 w-28 border-4 border-white shadow-lg relative overflow-hidden">
                    {/* 🌟 NEW: Loading overlay for the avatar */}
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-slate-900/40 z-10 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                    <AvatarImage src={profile?.photoURL} className="object-cover" />
                    <AvatarFallback className="text-4xl bg-violet-100 text-violet-700 font-bold">{profile?.fullName?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <label htmlFor="profile-upload" className={`absolute bottom-0 right-0 bg-violet-600 p-2.5 rounded-full text-white cursor-pointer shadow-lg hover:bg-violet-700 transition-all z-20 ${uploadingImage ? "pointer-events-none opacity-50" : ""}`}>
                    <Camera className="w-5 h-5" />
                    {/* 🌟 MODIFIED: Triggers handleFileChange instead of direct upload */}
                    <input id="profile-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploadingImage} />
                  </label>
                </div>
              </div>
              <div className="space-y-2"><Label className="font-semibold text-slate-700 ml-1">Full Name</Label><Input value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} required className="h-13 rounded-2xl bg-slate-50/50" /></div>
              <div className="space-y-2"><Label className="font-semibold text-slate-700 ml-1">Phone Number</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="h-13 rounded-2xl bg-slate-50/50" /></div>
              <div className="space-y-2 pb-2"><Label className="font-semibold text-slate-700 ml-1">Location</Label><LocationPicker address={form.address} lat={form.latitude} lng={form.longitude} onLocationChange={(loc) => setForm({...form, address: loc.address, latitude: loc.lat, longitude: loc.lng })} /></div>
              <div className="space-y-3 pt-2">
                <Label className="font-semibold text-slate-700 ml-1">Food Preferences</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full h-13 rounded-2xl justify-between font-normal text-slate-500 bg-white border-slate-200">
                      {form.foodTags.length > 0 ? `${form.foodTags.length} selected` : "Select tags..."} <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] bg-white z-50 shadow-lg rounded-2xl max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel className="text-violet-600 font-bold px-4 pt-2">Categories</DropdownMenuLabel>
                    {FOOD_TYPES.map((o) => (<DropdownMenuCheckboxItem key={o} checked={form.foodTags.includes(o)} onCheckedChange={() => toggleFoodTag(o)} className="rounded-lg mx-1">{o}</DropdownMenuCheckboxItem>))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-violet-600 font-bold px-4 pt-2">Dietary</DropdownMenuLabel>
                    {FOOD_TAGS.map((o) => (<DropdownMenuCheckboxItem key={o} checked={form.foodTags.includes(o)} onCheckedChange={() => toggleFoodTag(o)} className="rounded-lg mx-1">{o}</DropdownMenuCheckboxItem>))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {form.foodTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {form.foodTags.map((o) => (
                      <Badge key={o} variant="secondary" className="bg-violet-50 text-violet-700 rounded-lg py-1.5 px-3 flex items-center gap-2">
                        {o} <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFoodTag(o); }} className="hover:bg-violet-200 rounded-full p-0.5"><X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" /></button>
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
              <Button type="button" variant="outline" className="h-13 rounded-2xl bg-white border-slate-200 font-bold" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" className="h-13 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-lg shadow-violet-200" disabled={saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save</>}
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Unified My Profile Card */}
          <div className="lg:col-span-5 space-y-6">
            
            <Card className="rounded-[2.5rem] border-slate-200 shadow-xl overflow-hidden bg-white flex flex-col">
              
              <CardHeader className="bg-violet-50/60 border-b border-violet-100 px-8 py-8 flex flex-row items-center justify-between m-0">
                <CardTitle className="text-2xl text-violet-900 font-bold">My Profile</CardTitle>
                <Button variant="outline" size="sm" onClick={handleEditClick} className="rounded-xl border-violet-200 text-violet-700 bg-white hover:bg-violet-50">
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </Button>
              </CardHeader>
              
              <CardContent className="p-0 flex flex-col h-full">
                
                {/* Identity Section */}
                <div className="px-8 pt-8 pb-6 flex flex-col items-center">
                  <Avatar className="h-32 w-32 border-4 border-violet-50 shadow-xl">
                    <AvatarImage src={profile?.photoURL} className="object-cover" />
                    <AvatarFallback className="text-4xl bg-violet-100 text-violet-700 font-bold">{profile?.fullName?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <h3 className="mt-4 text-2xl font-bold text-slate-900 text-center">{profile?.fullName || "New User"}</h3>
                  <Badge variant="outline" className="mt-1 bg-slate-50 border-slate-200 text-slate-500 capitalize">{profile?.role || "Member"}</Badge>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    <button onClick={() => navigate('/profile/reviews')} className="flex items-center bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-full px-4 py-1.5 transition-all active:scale-95 group shadow-sm">
                      <Star className="text-amber-500 fill-amber-500 w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-amber-700 text-sm">{reputation.average > 0 ? reputation.average : "New"}</span>
                      <span className="text-amber-300 mx-2">•</span>
                      <span className="text-xs font-bold text-amber-700/80 uppercase tracking-wider">{reputation.total} {reputation.total === 1 ? "Review" : "Reviews"}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-400 ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    <button onClick={() => navigate('/profile/reports')} className="flex items-center bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-full px-4 py-1.5 transition-all active:scale-95 group shadow-sm">
                      <AlertOctagon className="text-slate-500 w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">My Reports</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Account Details Section */}
                <div className="px-8 pb-8 space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-6 mb-2">Account Details</h3>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-violet-600"><Mail className="w-5 h-5" /></div>
                    <div className="overflow-hidden"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</p><p className="font-medium text-slate-700 truncate">{profile?.email}</p></div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-emerald-600"><Phone className="w-5 h-5" /></div>
                    <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</p><p className="font-medium text-slate-700">{profile?.phone || "Not set"}</p></div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-blue-600 shrink-0"><MapPin className="w-5 h-5" /></div>
                    <div className="flex-1"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Primary Address</p><p className="font-medium text-slate-700 leading-relaxed">{profile?.address || "Not set"}</p></div>
                  </div>
                </div>
                
                {/* Matching Preferences Section */}
                <div className="bg-violet-600 p-8 relative overflow-hidden group mt-auto">
                  <SparkleIcon className="absolute top-0 right-0 w-32 h-32 text-white/10 -mr-6 -mt-6 transition-transform group-hover:scale-110 pointer-events-none" />
                  <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mb-4">Matching Preferences</p>
                  <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                    {profile?.preferences?.foodTags?.length > 0 ? (
                      profile.preferences.foodTags.map(tag => (
                        <Badge key={tag} className="bg-white/20 text-white border-none backdrop-blur-md rounded-lg py-1.5 px-3">{tag}</Badge>
                      ))
                    ) : (<span className="text-white/60 italic text-sm">No restrictions set</span>)}
                  </div>
                  <div className="flex gap-6 text-xs text-violet-100 font-bold border-t border-white/10 pt-5 relative z-10">
                    <p>RADIUS: <span className="text-white text-sm ml-1">{profile?.preferences?.radiusKm || 10} KM</span></p>
                    <p>PAX: <span className="text-white text-sm ml-1">{profile?.preferences?.quantity || 1} PEOPLE</span></p>
                  </div>
                </div>

              </CardContent>
            </Card>

          </div>

          {/* RIGHT COLUMN: Gamification Impact Dashboard & Logout */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="rounded-[2.5rem] bg-slate-900 border-none shadow-2xl relative overflow-hidden group w-full">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl pointer-events-none"></div>
              
              <CardContent className="p-8 sm:p-10 relative z-10">
                
                {/* Hero Stats */}
                <div className="flex items-start justify-between mb-8 border-b border-white/10 pb-6">
                  <div>
                    <Badge className="bg-violet-500/20 text-violet-300 border border-violet-500/30 px-3 py-1 mb-2 font-bold uppercase tracking-wider">
                      Level {heroStats.level} {heroStats.rank}
                    </Badge>
                    <h3 className="text-4xl sm:text-5xl font-black text-white">{heroStats.points.toLocaleString()} <span className="text-lg font-bold text-slate-400 uppercase tracking-widest ml-1">KP</span></h3>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col items-center">
                     {heroStats.level >= 15 ? <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 mb-1" /> : <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 mb-1" />}
                     <span className="text-[10px] font-bold text-slate-400 uppercase">{heroStats.rank} Rank</span>
                  </div>
                </div>

                {/* Motivational Quote */}
                <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 mb-8 flex items-start gap-3">
                   <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0 mt-0.5" />
                   <p className="text-sm sm:text-base font-medium text-emerald-100 leading-relaxed">{getMotivationalSentence()}</p>
                </div>

                {/* THE 6-GRID IMPACT DASHBOARD */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  
                  {/* Card 1: Total Food Saved */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-colors hover:bg-white/10">
                    <HeartPulse className="w-6 h-6 sm:w-7 sm:h-7 text-rose-400 mb-2" />
                    <span className="text-2xl sm:text-3xl font-black text-white">{personalImpact.totalFoodSaved}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Total Food Saved</span>
                  </div>

                  {/* Card 2: Value Generated */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-colors hover:bg-white/10">
                    <Banknote className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400 mb-2" />
                    <span className="text-2xl sm:text-3xl font-black text-white"><span className="text-sm text-emerald-400 mr-1">RM</span>{personalImpact.economicValue.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Value Saved</span>
                  </div>

                  {/* Card 3: CO2 Prevented */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-colors hover:bg-white/10">
                    <Leaf className="w-6 h-6 sm:w-7 sm:h-7 text-sky-400 mb-2" />
                    <span className="text-2xl sm:text-3xl font-black text-white">{personalImpact.co2Saved}<span className="text-xs text-sky-400 ml-1">kg</span></span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wider">CO₂ Avoided</span>
                  </div>
                  
                  {/* Card 4: Waste Saved */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-colors hover:bg-white/10">
                    <Recycle className="w-6 h-6 sm:w-7 sm:h-7 text-violet-400 mb-2" />
                    <span className="text-2xl sm:text-3xl font-black text-white">{personalImpact.wastePrevented}<span className="text-xs text-violet-400 ml-1">kg</span></span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Waste Saved</span>
                  </div>

                  {/* Card 5: Meals Shared */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-colors hover:bg-white/10">
                    <HandPlatter className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400 mb-2" />
                    <span className="text-2xl sm:text-3xl font-black text-white">{personalImpact.mealsGiven}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Meals Shared</span>
                  </div>

                  {/* Card 6: Meals Rescued */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-colors hover:bg-white/10">
                    <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400 mb-2" />
                    <span className="text-2xl sm:text-3xl font-black text-white">{personalImpact.mealsRescued}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Meals Rescued</span>
                  </div>

                </div>

                <button onClick={() => navigate('/profile/sanctuary')} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold py-4 sm:py-5 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-lg">
                  <Flame className="w-6 h-6" /> Enter The Sanctuary
                </button>
              </CardContent>
            </Card>

            {/* Logout Button strictly below the Impact Dashboard */}
            <Button variant="ghost" className="w-full h-14 rounded-2xl text-red-500 hover:text-red-600 hover:bg-red-50 font-bold border border-red-100 transition-all bg-white shadow-sm" onClick={handleSecureLogout}>
              <LogOut className="w-5 h-5 mr-3" /> Logout Account
            </Button>

          </div>

        </div>
      )}
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