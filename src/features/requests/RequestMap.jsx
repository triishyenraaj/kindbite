import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { useState, useMemo, useRef, useCallback, useEffect } from "react"; 
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation, Clock, X, ShoppingBag, MapPinOff } from "lucide-react"; // <-- Added ShoppingBag

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

// --- CUSTOM SPEECH BUBBLE & SOLID MEGAPHONE PIN (FOR REQUESTS) ---
const createCustomRequestPin = (fillColor) => {
  const svg = `
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1" flood-color="black" flood-opacity="0.2"/>
      </filter>
      
      <path d="M20 3H4C2.9 3 2 3.9 2 5V15C2 16.1 2.9 17 4 17H10L12 21L14 17H20C21.1 17 22 16.1 22 15V5C22 3.9 21.1 3 20 3Z" 
            fill="${fillColor}" stroke="white" stroke-width="1.2" filter="url(#shadow)"/>
      
      <g transform="translate(3.5, 2.5) scale(0.6)" fill="white">
        <path d="M4.5 9.5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1v3.5a1.5 1.5 0 0 0 3 0v-3.5h1.1l5.4 3.6A1 1 0 0 0 16.5 17V7a1 1 0 0 0-1.5-.8L9.6 9.5H4.5z"/>
        <path d="M18 10v4c1.1 0 2-.9 2-2s-.9-2-2-2zm0-4v2c2.2 0 4 1.8 4 4s-1.8 4-4 4v2c3.3 0 6-2.7 6-6s-2.7-6-6-6z"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export default function RequestMap({ requests, userLocation }) {
  const navigate = useNavigate();
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  useEffect(() => {
    if (selectedRequest) {
      const updatedRequest = requests.find((r) => r.id === selectedRequest.id);
      if (updatedRequest) {
        if (JSON.stringify(selectedRequest) !== JSON.stringify(updatedRequest)) {
          setSelectedRequest(updatedRequest);
        }
      } else {
        setSelectedRequest(null);
      }
    }
  }, [requests, selectedRequest]);

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
    if (!expiryDateTime) return { color: "#7c3aed", label: "No Expiry" }; 
    const now = new Date();
    const expiryDate = new Date(expiryDateTime);
    const hoursLeft = (expiryDate - now) / (1000 * 60 * 60);

    if (hoursLeft <= 0) return { color: "#64748b", label: "Expired" };    
    if (hoursLeft <= 3) return { color: "#ef4444", label: "URGENT" };  
    if (hoursLeft <= 12) return { color: "#f97316", label: "NEEDED SOON" }; 
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

      {/* 🌟 NEW: MISSING LOCATION PROMPT */}
      {!userLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none flex justify-center w-full">
          
          {/* Notice the w-max and whitespace-nowrap here */}
          <div className="bg-amber-50/95 backdrop-blur-md border border-amber-200 shadow-lg px-4 py-2 rounded-full flex items-center gap-2 w-max whitespace-nowrap">
            
            <div className="bg-amber-100 p-1 rounded-full shrink-0">
              <MapPinOff className="w-3.5 h-3.5 text-amber-600" />
            </div>
            
            <span className="text-[11px] md:text-xs font-bold text-amber-800 tracking-tight">
              Enable device location for precise local results
            </span>
            
          </div>
        </div>
      )}

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

        {requests.map((request) => {
          const status = getUrgencyStatus(request.expiryDateTime);
          return (
            <Marker
              key={request.id}
              position={{ lat: request.latitude, lng: request.longitude }}
              onClick={() => setSelectedRequest(request)}
              icon={{ 
                url: createCustomRequestPin(status.color), 
                anchor: new google.maps.Point(20, 35),
                scaledSize: new google.maps.Size(40, 40)
              }}
              zIndex={status.color === "#ef4444" ? 100 : 1} 
            />
          );
        })}

        {selectedRequest && (
          <InfoWindow
            position={{ lat: selectedRequest.latitude, lng: selectedRequest.longitude }}
            onCloseClick={() => setSelectedRequest(null)}
          >
            <div className="w-[200px] bg-white flex flex-col relative">
              
              <div className="relative w-full h-32 -mt-1 overflow-hidden bg-slate-50"> 
                {/* --- IMAGE OR PREMIUM FALLBACK --- */}
                {selectedRequest.imageURLs?.length > 0 ? (
                  <img 
                    src={selectedRequest.imageURLs[0]} 
                    className="w-full h-full object-cover"
                    alt="Request"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-50 to-violet-100/60 flex flex-col items-center justify-center relative">
                    <div className="absolute top-[-20%] right-[-10%] w-20 h-20 bg-violet-200/40 rounded-full blur-xl"></div>
                    <div className="absolute bottom-[-20%] left-[-10%] w-16 h-16 bg-blue-200/30 rounded-full blur-lg"></div>
                    
                    <div className="w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-white z-10">
                      <ShoppingBag className="w-6 h-6 text-violet-400 stroke-[2]" />
                    </div>
                    <span className="mt-2 text-[9px] font-black text-violet-400/80 uppercase tracking-widest z-10">
                      Food Request
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setSelectedRequest(null)}
                  className="absolute top-2 right-2 z-50 p-1 bg-black/40 text-white rounded-full backdrop-blur-sm hover:bg-black/60 active:scale-95 transition-all"
                >
                  <X className="w-4 h-4 stroke-[3px]" />
                </button>
                
                {(() => {
                  const status = getUrgencyStatus(selectedRequest.expiryDateTime);
                  
                  // UPDATED: Now allows "Under 24h" to pass through
                  if (status.label !== "URGENT" && status.label !== "NEEDED SOON" && status.label !== "Under 24h") return null;

                  // Define dynamic background based on the label
                  let badgeBg = "bg-yellow-500 text-white"; 
                  if (status.label === "URGENT") badgeBg = "bg-red-500 text-white animate-pulse";
                  if (status.label === "NEEDED SOON") badgeBg = "bg-orange-500 text-white";

                  return (
                    <div className={`absolute top-2 left-2 z-20 px-2 py-0.5 rounded shadow-sm text-[9px] font-black uppercase ${badgeBg}`}>
                      {status.label}
                    </div>
                  );
                })()}
              </div>

              <div className="px-3 py-3 space-y-3">
                <div className="space-y-0.5">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-slate-900 text-sm leading-tight truncate flex-1">
                      {selectedRequest.foodName}
                    </h4>
                    <span className="flex items-center gap-1 bg-violet-100 text-violet-700 text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0">
                      {selectedRequest.quantity} <span className="opacity-70">pax</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">
                    {getShortAddress(selectedRequest.address)}
                  </p>
                </div>
                
                <Button 
                  className="w-full h-8 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold rounded-lg shadow-sm"
                  onClick={() => navigate(`/requests/${selectedRequest.id}`)}
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