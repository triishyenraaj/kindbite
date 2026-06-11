import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { getUserProfile } from "@/features/users/userService";
import { createDonation, updateDonation, uploadDonationImages } from "@/features/donations/donationService";
import { FOOD_TYPES, FOOD_TAGS } from "@/utils/foodOptions";
import LocationPicker from "@/features/maps/LocationPicker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, X, Loader2, ImagePlus, Camera, Sparkles } from "lucide-react"; // 🌟 ADDED Sparkles

import { detectFoodTags } from "@/utils/gemini";

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function DonationForm({ onCreated, initialData }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [isScanningImage, setIsScanningImage] = useState(false);
  
  // 🌟 NEW: Track the exact AI description to power the disappearing badge
  const [aiOriginalDesc, setAiOriginalDesc] = useState("");

  const isEdit = !!initialData;

  const [form, setForm] = useState({
    foodName: "",
    description: "",
    foodType: "",
    selectedExtraTags: [],
    quantity: 1,
    quantityUnit: "pax", // 🌟 Retained under the hood so database doesn't break
    expiryDateTime: "",
    address: "",
    latitude: null,
    longitude: null,
    files: [], 
    existingImages: [], 
  });

  const [previews, setPreviews] = useState([]);

  const hasImage = form.files.length > 0 || form.existingImages.length > 0;

  useEffect(() => {
    if (initialData) {
      setForm({
        ...initialData,
        selectedExtraTags: initialData.foodTags?.filter(tag => tag !== initialData.foodType) || [],
        files: [],
        existingImages: initialData.imageURLs || [],
      });
    }
  }, [initialData]);

  useEffect(() => {
    return () => previews.forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  const combinedFoodTags = useMemo(() => {
    const merged = [form.foodType, ...form.selectedExtraTags].filter(Boolean);
    return [...new Set(merged)];
  }, [form.foodType, form.selectedExtraTags]);

  function toggleTag(tag) {
    setForm((prev) => {
      if (tag === "No Restrictions") return { ...prev, selectedExtraTags: ["No Restrictions"] };
      const filtered = prev.selectedExtraTags.filter((item) => item !== "No Restrictions");
      if (filtered.includes(tag)) return { ...prev, selectedExtraTags: filtered.filter((item) => item !== tag) };
      return { ...prev, selectedExtraTags: [...filtered, tag] };
    });
  }

  async function handleFileChange(e) {
    if (isScanningImage) return;

    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setForm((prev) => ({ ...prev, files: [...prev.files, ...newFiles] }));
    setPreviews((prev) => [...prev, ...newPreviews]);

    const fileToScan = newFiles[0];
    if (fileToScan) {
      setIsScanningImage(true);
      try {
        const base64Image = await fileToBase64(fileToScan);
        const aiResult = await detectFoodTags(base64Image);
        
        console.log("✨ Gemini JSON Result:", aiResult);

        if (aiResult) {
          
          if (aiResult.isFood === false) {
            alert(aiResult.description); 
            
            setForm((prev) => ({
              ...prev,
              files: prev.files.slice(0, -newFiles.length)
            }));
            setPreviews((prev) => {
              newPreviews.forEach(url => URL.revokeObjectURL(url));
              return prev.slice(0, -newPreviews.length);
            });
            return; 
          }

          // 🌟 NEW: Set the AI tracker state
          if (aiResult.description) {
            setAiOriginalDesc(aiResult.description);
          }

          setForm((prev) => {
            const newFoodName = prev.foodName.trim() === "" && aiResult.foodName
              ? aiResult.foodName
              : prev.foodName;

            // 🌟 MODIFIED: Clean injection without the string prefix
            const newDescription = prev.description.trim() === "" && aiResult.description
              ? aiResult.description
              : prev.description;

            return {
              ...prev,
              foodName: newFoodName,
              foodType: prev.foodType ? prev.foodType : (aiResult.primaryCategory || prev.foodType),
              selectedExtraTags: [...new Set([...prev.selectedExtraTags, ...(aiResult.additionalTags || [])])],
              description: newDescription
            };
          });
        }
      } catch (error) {
        console.error("AI Tagging failed:", error);
      } finally {
        setIsScanningImage(false);
      }
    }
  }

  function removeFile(index) {
    URL.revokeObjectURL(previews[index]);
    setForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingImage(index) {
    setForm(prev => ({
      ...prev,
      existingImages: prev.existingImages.filter((_, i) => i !== index)
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!user?.uid) return setError("You must be logged in.");
    if (!hasImage) return setError("Please upload at least one image of the food.");
    if (!form.foodName || !form.foodType || !form.quantity || !form.expiryDateTime || !form.address) {
      return setError("Please fill in all required fields.");
    }

    const selectedDate = new Date(form.expiryDateTime);
    if (selectedDate <= new Date()) {
      return setError("The expiry date and time must be in the future.");
    }

    try {
      setSaving(true);
      const profile = await getUserProfile(user.uid);
      
      let finalImageURLs = [...(form.existingImages || [])];
      
      if (form.files.length > 0) {
        const uploadedURLs = await uploadDonationImages(user.uid, form.files);
        finalImageURLs = [...finalImageURLs, ...uploadedURLs];
      }

      // 🌟 NEW: Check if description was untouched. If so, secretly append the label!
      const finalDescription = (aiOriginalDesc && form.description === aiOriginalDesc) 
        ? `✨ [AI Generated] ${form.description}` 
        : form.description;

      const donationPayload = {
        donorId: user.uid,
        donorName: profile?.fullName || user.email || "Unknown User",
        contactNumber: profile?.phone || "",
        foodName: form.foodName,
        description: finalDescription, // 🌟 Updated payload
        foodType: form.foodType,
        foodTags: combinedFoodTags,
        quantity: Number(form.quantity),
        quantityUnit: form.quantityUnit, // Safely still passing "pax"
        expiryDateTime: form.expiryDateTime,
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
        imageURLs: finalImageURLs,
        status: initialData?.status || "available",
      };

      if (isEdit) {
        await updateDonation(initialData.id, donationPayload);
      } else {
        await createDonation(donationPayload);
      }

      if (onCreated) onCreated();
    } catch (err) {
      console.error(err);
      setError(`Failed to ${isEdit ? "update" : "create"} donation.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-violet-50/80 border-b border-violet-100 p-0">
        <CardTitle className="text-xl text-violet-900 font-bold px-6 py-4">
          {isEdit ? "Edit Donation" : "Post a Donation"}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit} className="flex flex-col">
        <CardContent className="pt-6 space-y-6">
          
          <div className="space-y-3 bg-violet-50/50 p-4 rounded-2xl border border-violet-100">
            <Label className="font-semibold text-violet-900 flex items-center gap-2">
              Step 1: Upload Food Images
              {!hasImage && <span className="text-xs font-normal text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">Required</span>}
            </Label>
            
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {form.existingImages?.map((url, index) => (
                <div key={`existing-${index}`} className="relative h-24 w-24 shrink-0 rounded-2xl overflow-hidden border border-slate-200">
                  <img src={url} className="h-full w-full object-cover grayscale-[0.2]" alt="Existing" />
                  <button type="button" onClick={() => removeExistingImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-sm">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {previews.map((url, index) => (
                <div key={`new-${index}`} className="relative h-24 w-24 shrink-0 rounded-2xl overflow-hidden border-2 border-violet-400">
                  <img src={url} className="h-full w-full object-cover" alt="New Preview" />
                  <button type="button" onClick={() => removeFile(index)} className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow-sm hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 h-28">
              <label 
                htmlFor="camera" 
                className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-2xl transition-colors ${
                  isScanningImage 
                  ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60" 
                  : "border-violet-300 cursor-pointer bg-white hover:bg-violet-50"
                }`}
              >
                <Camera className={`w-8 h-8 mb-1 ${isScanningImage ? "text-slate-400" : "text-violet-500"}`} />
                <p className={`text-xs font-bold uppercase ${isScanningImage ? "text-slate-400" : "text-violet-700"}`}>Take Photo</p>
                <input id="camera" type="file" accept="image/*" capture="environment" onChange={handleFileChange} disabled={isScanningImage} className="hidden" />
              </label>
              
              <label 
                htmlFor="images" 
                className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-2xl transition-colors ${
                  isScanningImage 
                  ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60" 
                  : "border-violet-300 cursor-pointer bg-white hover:bg-violet-50"
                }`}
              >
                <ImagePlus className={`w-8 h-8 mb-1 ${isScanningImage ? "text-slate-400" : "text-violet-500"}`} />
                <p className={`text-xs font-bold uppercase ${isScanningImage ? "text-slate-400" : "text-violet-700"}`}>Photo Library</p>
                <input id="images" type="file" accept="image/*" multiple onChange={handleFileChange} disabled={isScanningImage} className="hidden" />
              </label>
            </div>

            {isScanningImage && (
              <div className="flex items-center justify-center gap-2 text-sm text-violet-700 font-bold mt-2 animate-pulse bg-white p-3 rounded-xl border border-violet-200 shadow-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>AI is analyzing your food...</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Label className="font-semibold text-slate-400 text-xs uppercase tracking-wider">Step 2: Details</Label>
            
            <div className="space-y-2">
              <Label htmlFor="foodName" className="font-semibold text-slate-700">Food Name *</Label>
              <Input id="foodName" value={form.foodName} onChange={(e) => setForm({ ...form, foodName: e.target.value })} placeholder="e.g. Extra Nasi Lemak" className="bg-white rounded-xl h-11" />
            </div>

            {/* 🌟 MODIFIED: Description Box with dynamic badge */}
            <div className="space-y-2 relative">
              <div className="flex justify-between items-end">
                <Label htmlFor="description" className="font-semibold text-slate-700">Description</Label>
                {/* Badge disappears the moment they change the text */}
                {aiOriginalDesc && form.description === aiOriginalDesc && (
                  <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                    <Sparkles className="w-3 h-3" /> AI Generated
                  </span>
                )}
              </div>
              <Textarea 
                id="description" 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })} 
                placeholder="Tell us more... (or upload a photo to let AI write this!)" 
                className="bg-white rounded-xl min-h-[100px] resize-none focus-visible:ring-violet-500" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="foodType" className="font-semibold text-slate-700">Primary Category *</Label>
              <div className="relative">
                <select id="foodType" value={form.foodType} onChange={(e) => setForm({ ...form, foodType: e.target.value })} className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm appearance-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Select food category...</option>
                  {FOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 opacity-50 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-semibold text-slate-700">Additional Tags</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-11 justify-between font-normal text-slate-500 bg-white rounded-xl">
                    {form.selectedExtraTags.length > 0 ? `${form.selectedExtraTags.length} tag(s) selected` : "Select tags (Halal, Vegan...)"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] bg-white z-50 shadow-lg rounded-xl">
                  {FOOD_TAGS.filter(tag => tag !== "No Restrictions").map((tag) => (
                    <DropdownMenuCheckboxItem key={tag} checked={form.selectedExtraTags.includes(tag)} onCheckedChange={() => toggleTag(tag)}>
                      {tag}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex flex-wrap gap-2">
                {combinedFoodTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-violet-50 text-violet-700 border-none rounded-lg px-2.5 py-1">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* 🌟 MODIFIED: Quantity (Pax Only) layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="font-semibold text-slate-700">Quantity (Pax) *</Label>
              <Input 
                id="quantity" 
                type="number" 
                min="1" 
                value={form.quantity} 
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} 
                className="bg-white rounded-xl h-11" 
              />
              <p className="text-[11px] text-slate-500 font-medium leading-tight pt-1">
                Please estimate the quantity in terms of how many people (pax) this can feed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDateTime" className="font-semibold text-slate-700">Expiry Date & Time *</Label>
              <Input id="expiryDateTime" type="datetime-local" value={form.expiryDateTime} onChange={(e) => setForm({ ...form, expiryDateTime: e.target.value })} className="bg-white rounded-xl h-11" />
            </div>
          </div>

          <div className="space-y-2 pb-2">
            <Label className="font-semibold text-slate-700">Pickup Location *</Label>
            <LocationPicker 
              address={form.address} lat={form.latitude} lng={form.longitude} 
              onLocationChange={(loc) => setForm({ ...form, address: loc.address, latitude: loc.lat, longitude: loc.lng })} 
            />
          </div>

          {error && <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
        </CardContent>

        <CardFooter className="bg-slate-50 border-t pt-4 pb-6 mt-4">
          <Button type="submit" className="w-full md:w-auto md:px-12 md:ml-auto bg-violet-600 hover:bg-violet-700 text-white shadow-lg h-14 rounded-2xl text-lg font-bold transition-all" disabled={saving || !hasImage}>
            {saving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {isEdit ? "Saving..." : "Publishing..."}</> : (isEdit ? "Save Changes" : "Post Donation")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}