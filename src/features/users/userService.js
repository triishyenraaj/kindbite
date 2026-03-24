import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/services/firebase/config";

export async function createUserProfile(user, extraData = {}) {
  const userRef = doc(db, "users", user.uid);

  const profileData = {
    uid: user.uid,
    email: user.email || "",
    fullName: extraData.fullName || "",
    phone: extraData.phone || "",
    role: extraData.role || "user", // Unified role
    
    // Added based on SRD Class Diagram for Map & Location Module
    address: extraData.address || "", 
    latitude: null,  // Will be populated later via Google Maps API
    longitude: null, // Will be populated later via Google Maps API
    
    // Added based on SRD Smart Matching Algorithm requirements
    preferences: {
      foodTags: extraData.preferences?.foodTags || [], // CHANGED from dietary
      radiusKm: extraData.preferences?.radiusKm || 10,
      quantity: extraData.preferences?.quantity || 1,
    },
    
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    photoURL: extraData.photoURL || "",
    profileCompleted: extraData.profileCompleted || false,
  };

  await setDoc(userRef, profileData, { merge: true });
  return profileData;
}

export async function getUserProfile(uid) {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return null;
  return snapshot.data();
}

export async function updateUserProfile(uid, updates) {
  const userRef = doc(db, "users", uid);

  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadProfilePicture(uid, file) {
  // 1. Create a reference to where the file will be saved in Firebase Storage
  const fileRef = ref(storage, `profiles/${uid}/profilePic_${Date.now()}`);
  
  // 2. Upload the file
  await uploadBytes(fileRef, file);
  
  // 3. Get the public download URL
  const photoURL = await getDownloadURL(fileRef);
  
  // 4. Update the user's Firestore document with the new URL
  await updateUserProfile(uid, { photoURL });
  
  return photoURL;
}