import { createContext, useContext, useState, useEffect } from "react";

const LocationContext = createContext();

export function LocationProvider({ children }) {
  const [anchorLocation, setAnchorLocation] = useState(null);

  useEffect(() => {
    // Automatically fetch GPS when the app loads
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setAnchorLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude, // Standardized to 'lon'
            label: "Current Location",
          });
        },
        (error) => console.log("User denied location or error:", error),
        { enableHighAccuracy: false, maximumAge: 900000, timeout: 5000 }
      );
    }
  }, []);

  return (
    <LocationContext.Provider value={{ anchorLocation, setAnchorLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocationContext = () => useContext(LocationContext);