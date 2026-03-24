import { useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocateFixed, Loader2 } from "lucide-react";

const libraries = ["places"];

export default function LocationPicker({ address, lat, lng, onLocationChange }) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries,
  });

  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Default to a central location if nothing is set
  const defaultCenter = { lat: 3.0738, lng: 101.5183 }; 
  const center = lat && lng ? { lat, lng } : defaultCenter;

  const onLoad = useCallback(function callback(map) {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
  }, []);

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current.getPlace();
    if (place.geometry) {
      const newLat = place.geometry.location.lat();
      const newLng = place.geometry.location.lng();
      const newAddress = place.formatted_address || place.name;
      
      onLocationChange({ address: newAddress, lat: newLat, lng: newLng });
      mapRef.current?.panTo({ lat: newLat, lng: newLng });
    }
  };

  const handleMapUpdate = (e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
      if (status === "OK" && results[0]) {
        onLocationChange({ address: results[0].formatted_address, lat: newLat, lng: newLng });
      } else {
        onLocationChange({ address: "Custom Map Location", lat: newLat, lng: newLng });
      }
    });
  };

  // --- NEW: Detect Current Location Logic ---
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;

        // Reverse Geocode the GPS coordinates into a street address
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
          if (status === "OK" && results[0]) {
            const newAddress = results[0].formatted_address;
            onLocationChange({ address: newAddress, lat: newLat, lng: newLng });
          } else {
            onLocationChange({ address: "Current Location", lat: newLat, lng: newLng });
          }
          mapRef.current?.panTo({ lat: newLat, lng: newLng });
          setIsDetecting(false);
        });
      },
      (error) => {
        console.error("Error detecting location:", error);
        alert("Please allow location permissions in your browser to use this feature.");
        setIsDetecting(false);
      },
      { enableHighAccuracy: true } // Forces GPS precision instead of IP estimation
    );
  };

  if (!isLoaded) return <div className="h-[200px] w-full animate-pulse bg-slate-200 rounded-md"></div>;

  return (
    <div className="space-y-3">
      {/* Search Bar & Auto-Detect Button Side-by-Side */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Autocomplete
            onLoad={(ref) => (autocompleteRef.current = ref)}
            onPlaceChanged={handlePlaceChanged}
          >
            <Input 
              type="text" 
              placeholder="Search for an address..." 
              value={address} 
              onChange={(e) => onLocationChange({ address: e.target.value, lat, lng })}
              className="w-full"
            />
          </Autocomplete>
        </div>
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleDetectLocation} 
          disabled={isDetecting}
          className="shrink-0 text-violet-600 border-violet-200 hover:bg-violet-50"
          title="Detect My Location"
        >
          {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
        </Button>
      </div>

      <div className="h-[200px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={15}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapUpdate}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          <Marker
            position={center}
            draggable={true}
            onDragEnd={handleMapUpdate}
          />
        </GoogleMap>
      </div>
    </div>
  );
}