import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { useState, useMemo, useRef, useCallback, useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation, Clock, X } from "lucide-react"; 

const libraries = ["places"];

// Responsive container height
const mapContainerStyle = {
  width: "100%",
  height: "100%", 
  borderRadius: "2rem",
};

// --- HELPER: getShortAddress ---
const getShortAddress = (address) => {
  if (!address) return "No location provided";
  const parts = address.split(',').map(p => p.trim());
  if (parts.length <= 2) return address;

  const cityIndex = parts.findIndex(p => /\b\d{5}\b/.test(p));
  if (cityIndex !== -1) {
    const city = parts[cityIndex].replace(/\b\d{5}\b/g, "").trim();
    const neighborhood = cityIndex > 0 ? parts[cityIndex - 1] : "";
    const state = parts[cityIndex + 1] || "";
    return [neighborhood, city, state].filter(Boolean).join(', ');
  }
  return parts.slice(0, 3).join(', ');
};

// --- CUSTOM HEART & UTENSILS SVG PIN GENERATOR ---
const createCustomFoodPin = (fillColor) => {
  const svg = `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="${fillColor}" flood-opacity="0.5"/>
      </filter>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
            fill="${fillColor}" stroke="white" stroke-width="1.5" filter="url(#shadow)"/>
      <g transform="translate(4.5, 4) scale(0.62)" fill="white">
        <path d="M11,5v3.5C11,9.9,10.2,11,9,11v8H7v-8C5.8,11,5,9.9,5,8.5V5h1v3.5C6,9.1,6.3,9.5,6.8,9.5S7.5,9.1,7.5,8.5V5h1v3.5C8.5,9.1,8.8,9.5,9.2,9.5s0.8-0.4,0.8-1V5H11z"/>
        <path d="M18,5c-1.7,0-3,1.6-3,3.5c0,1.7,1.1,3.1,2.5,3.4V19h2v-7.1c1.4-0.3,2.5-1.7,2.5-3.4C21,6.6,19.7,5,18,5z"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export default function DonationMap({ donations, userLocation }) {
  const navigate = useNavigate();
  const [selectedDonation, setSelectedDonation] = useState(null);
  
  useEffect(() => {
    if (selectedDonation) {
      const updatedDonation = donations.find((d) => d.id === selectedDonation.id);
      if (updatedDonation) {
        if (JSON.stringify(selectedDonation) !== JSON.stringify(updatedDonation)) {
          setSelectedDonation(updatedDonation);
        }
      } else {
        setSelectedDonation(null);
      }
    }
  }, [donations, selectedDonation]);

  const mapRef = useRef(null);
  
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleRecenter = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.panTo({ lat: userLocation.lat, lng: userLocation.lon });
      mapRef.current.setZoom(15);
    }
  };

  const getUrgencyStatus = (expiryDateTime) => {
    if (!expiryDateTime) return { color: "#8b5cf6", label: "No Expiry" }; 
    const now = new Date();
    const expiryDate = new Date(expiryDateTime);
    const hoursLeft = (expiryDate - now) / (1000 * 60 * 60);

    if (hoursLeft <= 0) return { color: "#64748b", label: "Expired" };    
    if (hoursLeft <= 3) return { color: "#ef4444", label: "URGENT" };  
    if (hoursLeft <= 12) return { color: "#f97316", label: "EXPIRING SOON" }; 
    if (hoursLeft <= 24) return { color: "#eab308", label: "Under 24h" }; 
    return { color: "#10b981", label: "24h+" }; 
  };

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries,
  });

  const center = useMemo(() => (
    userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lon } 
      : { lat: 3.0738, lng: 101.5183 }
  ), [userLocation]);

  if (loadError) return <div className="p-4 text-red-500 bg-red-50 rounded-2xl h-full flex items-center justify-center">Error loading map script.</div>;

  if (!isLoaded) {
    return (
      <div className="w-full h-[60vh] lg:h-[75vh] flex flex-col items-center justify-center bg-slate-100 border border-slate-200 rounded-[2rem]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600 mb-2" />
        <p className="text-sm text-slate-500 font-bold">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[60vh] lg:h-[75vh] animate-in fade-in zoom-in-95 duration-500 relative">
      
      <style>{`
        .gm-style-iw.gm-style-iw-c {
          padding: 0 !important;
          border-radius: 16px !important;
          overflow: hidden !important;
        }
        .gm-style-iw-d {
          padding: 0 !important;
          overflow: hidden !important;
          max-height: none !important;
        }
        button.gm-ui-hover-effect {
          display: none !important;
        }
      `}</style>

      {/* URGENCY LEGEND */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-100 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-0.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Left</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
          <div className="w-3 h-3 rounded-full bg-red-500"></div> Under 3 Hours
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div> Under 12 Hours
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div> Under 24 Hours
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div> 24+ Hours
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={14}
        center={center}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{
          disableDefaultUI: true,
          zoomControl: false,
          styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
        }}
      >
        {userLocation && (
          <Marker
            position={{ lat: userLocation.lat, lng: userLocation.lon }}
            icon={{ path: 0, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeColor: "white", strokeWeight: 3 }}
            zIndex={999} 
          />
        )}

        {donations.map((donation) => {
          const status = getUrgencyStatus(donation.expiryDateTime);
          return (
            <Marker
              key={donation.id}
              position={{ lat: donation.latitude, lng: donation.longitude }}
              onClick={() => setSelectedDonation(donation)}
              icon={{ 
                url: createCustomFoodPin(status.color), 
                anchor: { x: 20, y: 36 } 
              }}
              zIndex={status.color === "#ef4444" ? 100 : 1} 
            />
          );
        })}

        {selectedDonation && (
          <InfoWindow
            position={{ lat: selectedDonation.latitude, lng: selectedDonation.longitude }}
            onCloseClick={() => setSelectedDonation(null)}
          >
            <div className="w-[200px] bg-white flex flex-col relative">
              
              <div className="relative w-full h-32 -mt-1"> 
                <img 
                  src={selectedDonation.imageURLs?.[0] || "https://placehold.co/200x200?text=Food"} 
                  className="w-full h-full object-cover"
                  alt="Food"
                />

                <button
                  onClick={() => setSelectedDonation(null)}
                  className="absolute top-2 right-2 z-50 p-1 bg-black/40 text-white rounded-full backdrop-blur-sm hover:bg-black/60 active:scale-95"
                >
                  <X className="w-4 h-4 stroke-[3px]" />
                </button>
                
                {(() => {
                  const status = getUrgencyStatus(selectedDonation.expiryDateTime);
                  if (status.label !== "URGENT" && status.label !== "EXPIRING SOON") return null;

                  return (
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded shadow-sm text-[9px] font-black text-white ${status.label === "URGENT" ? "bg-red-500 animate-pulse" : "bg-orange-500"}`}>
                      {status.label}
                    </div>
                  );
                })()}
              </div>

              <div className="px-3 py-3 space-y-3">
                <div className="space-y-0.5">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-slate-900 text-sm leading-tight truncate flex-1">
                      {selectedDonation.foodName}
                    </h4>
                    <span className="flex items-center gap-1 bg-violet-100 text-violet-700 text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0">
                      {selectedDonation.quantity} <span className="opacity-70">pax</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">
                    {getShortAddress(selectedDonation.address)}
                  </p>
                </div>
                
                <Button 
                  className="w-full h-8 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold rounded-lg shadow-sm"
                  onClick={() => navigate(`/donations/${selectedDonation.id}`)}
                >
                  View Details
                </Button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {userLocation && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-6 right-4 z-10 p-3.5 bg-white text-violet-600 rounded-full shadow-lg border border-slate-100 hover:bg-violet-50 transition-all active:scale-95"
        >
          <Navigation className="w-5 h-5 fill-current" />
        </button>
      )}
    </div>
  );
}