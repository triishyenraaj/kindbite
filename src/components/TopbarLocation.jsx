import { useState, useEffect } from "react";
import { MapPin, X, Home, CheckCircle2 } from "lucide-react";
import { useLocationContext } from "@/features/location/LocationContext";
import { Button } from "@/components/ui/button";
import LocationPicker from "@/features/maps/LocationPicker"; 
import { useAuth } from "@/features/auth/AuthContext";
import { getUserProfile } from "@/features/users/userService";

export default function TopbarLocation() {
  const { anchorLocation, setAnchorLocation } = useLocationContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 🌟 NEW: Temporary state so typing doesn't close the modal!
  const [tempLocation, setTempLocation] = useState(null);
  
  const { user } = useAuth();
  const [savedProfile, setSavedProfile] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then(data => setSavedProfile(data));
    }
  }, [user]);

  if (!anchorLocation) return null;

  // 🌟 NEW: Initialize the temporary location when opening the modal
  const handleOpenModal = () => {
    setTempLocation({
      lat: anchorLocation.lat,
      lng: anchorLocation.lon, // Temp uses lng to talk to LocationPicker safely
      address: anchorLocation.label
    });
    setIsModalOpen(true);
  };

  // 🌟 NEW: Updates ONLY the temporary state while you type or drag the pin
  const handleTempLocationUpdate = (newLoc) => {
    setTempLocation({
      lat: newLoc.lat,
      lng: newLoc.lng,
      address: newLoc.address,
    });
    // Notice: We do NOT close the modal here anymore!
  };

  // 🌟 NEW: The button that actually locks in your choice and closes the modal
  const handleConfirmLocation = () => {
    setAnchorLocation({
      lat: tempLocation.lat,
      lon: tempLocation.lng, // Maps back to lon for your scoring logic
      label: tempLocation.address || "Selected Location",
    });
    setIsModalOpen(false);
  };

  const handleUseHomeAddress = () => {
    if (savedProfile?.latitude && savedProfile?.longitude) {
      setAnchorLocation({
        lat: savedProfile.latitude,
        lon: savedProfile.longitude,
        label: "Home: " + (savedProfile.address || "Saved Location")
      });
      setIsModalOpen(false);
    } else {
      alert("You don't have a specific location saved in your profile yet!");
    }
  };

  return (
    <>
      <div className="w-full bg-violet-50 border border-violet-100 rounded-2xl p-3 mb-4 flex items-center justify-between shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-3 overflow-hidden pr-4">
          <div className="bg-white p-2 rounded-full shadow-sm text-violet-600 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-600/70">
              Browsing Near
            </span>
            <span className="text-sm font-bold text-violet-900 truncate">
              {anchorLocation.label || "Selected Area"}
            </span>
          </div>
        </div>
        
        <button 
          onClick={handleOpenModal}
          className="shrink-0 text-xs font-bold text-violet-600 bg-white px-3 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-violet-100 hover:text-violet-800 transition-colors active:scale-95 border border-violet-100"
        >
          Change
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-violet-600" /> Change Location
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5">
              <p className="text-xs text-slate-500 font-medium mb-4">
                Search for a new neighborhood or drop a pin to see food rescues in that area.
              </p>
              
              <Button 
                variant="outline" 
                className="w-full mb-4 h-12 rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50 font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                onClick={handleUseHomeAddress}
              >
                <Home className="w-4 h-4" /> Use Saved Home Address
              </Button>
              
              {/* Passes the TEMP state instead of the Global Context */}
              <LocationPicker 
                address={tempLocation?.address === "Current Location" ? "" : tempLocation?.address || ""}
                lat={tempLocation?.lat}
                lng={tempLocation?.lng}
                onLocationChange={handleTempLocationUpdate}
              />

              {/* 🌟 NEW: The Confirm Button */}
              <Button 
                onClick={handleConfirmLocation}
                className="w-full mt-4 h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <CheckCircle2 className="w-5 h-5" /> Confirm New Location
              </Button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}