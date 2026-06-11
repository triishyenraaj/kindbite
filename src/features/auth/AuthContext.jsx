import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth"; // 🛑 CHANGE 1: Imported signOut
import { doc, onSnapshot } from "firebase/firestore"; 
import { auth, db } from "@/services/firebase/config"; 

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(false); 
  const [role, setRole] = useState("user"); 
  const [authLoading, setAuthLoading] = useState(true);

  // 1. Listen for Firebase Auth changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
      
      // If nobody is logged in, we can stop loading immediately.
      // If someone IS logged in, we leave authLoading as TRUE and let the next useEffect handle it.
      if (!firebaseUser) {
        setProfileCompleted(false);
        setRole("user"); // Reset role on logout
        setAuthLoading(false); 
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Listen for Firestore Profile changes (Only runs when 'user' exists)
  useEffect(() => {
    if (!user) return; // Ignore if no user is logged in

    const profileRef = doc(db, "users", user.uid);
    
    // onSnapshot listens for real-time updates to the document
    const unsubscribeProfile = onSnapshot(
      profileRef, 
      async (docSnap) => { // 🛑 CHANGE 2: Made this callback function 'async'
        if (docSnap.exists()) {
          const data = docSnap.data();

          // 🛑 CHANGE 3: The Active Patrol - Check for suspension in real-time
          if (data.status === "suspended") {
            alert("Security Alert: Your account has been suspended by an admin. You will be logged out immediately.");
            await signOut(auth); // Force the logout
            return; // Stop execution so it doesn't set profile variables
          }

          setProfileCompleted(!!data.profileCompleted);
          setRole(data.role || "user"); // Extract role, default to "user" if it doesn't exist
        } else {
          setProfileCompleted(false);
          setRole("user");
        }
        // NOW we can finally drop the loading screen, because we have both Auth + Profile!
        setAuthLoading(false); 
      },
      (error) => {
        console.error("Profile listener error:", error);
        setProfileCompleted(false);
        setRole("user");
        setAuthLoading(false); // Stop loading even if there's an error so the app doesn't freeze
      }
    );

    return () => unsubscribeProfile();
  }, [user]);

  // 3. Memoize the values to prevent unnecessary re-renders across the app
  const value = useMemo(
    () => ({
      user,
      authLoading,
      profileCompleted, // Expose to the rest of the app
      role, // Expose raw role string
      isAdmin: role === "admin", // Helpful boolean for quick admin checks
      isAuthenticated: !!user,
    }),
    [user, authLoading, profileCompleted, role] // Make sure to add 'role' to dependencies
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to easily grab the context anywhere in your app
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};