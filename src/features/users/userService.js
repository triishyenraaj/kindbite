import { doc, getDoc, serverTimestamp, setDoc, updateDoc, collection, getDocs, deleteField } from "firebase/firestore"; // 🛑 NEW: Added deleteField
import { db, storage, messaging } from "@/services/firebase/config"; 
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getToken } from "firebase/messaging"; 

export async function createUserProfile(user, extraData = {}) {
  const userRef = doc(db, "users", user.uid);

  const profileData = {
    uid: user.uid,
    email: user.email || "",
    fullName: extraData.fullName || "",
    phone: extraData.phone || "",
    role: extraData.role || "user", 
    
    address: extraData.address || "", 
    latitude: null,  
    longitude: null, 
    
    preferences: {
      foodTags: extraData.preferences?.foodTags || [], 
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
  const fileRef = ref(storage, `profiles/${uid}/profilePic_${Date.now()}`);
  await uploadBytes(fileRef, file);
  const photoURL = await getDownloadURL(fileRef);
  await updateUserProfile(uid, { photoURL });
  
  return photoURL;
}

export async function getAllUsers() {
  try {
    const usersRef = collection(db, "users");
    const querySnapshot = await getDocs(usersRef);
    
    const usersList = [];
    querySnapshot.forEach((doc) => {
      usersList.push({ id: doc.id, ...doc.data() });
    });
    
    return usersList;
  } catch (error) {
    console.error("Error fetching all users:", error);
    throw error;
  }
}

// The Notification "Bouncer"
export async function requestNotificationPermission(userId) {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      const currentToken = await getToken(messaging, { 
        vapidKey: "BLJ7kctGKlgSA9gJsFVjprRPv-3fu9FlRHNLcWQa3bDmmNALyEz7vyUZgd9aSDXjr1MMrjIggwxD410X4nIPdgo" 
      });

      if (currentToken) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          fcmToken: currentToken
        });
        console.log("Notification token saved successfully!");
      }
    } else {
      console.log("User denied notification permissions.");
    }
  } catch (error) {
    console.error("Error requesting notification permission:", error);
  }
}

// 🛑 NEW: The Token Cleanup Function (For Secure Logouts)
export async function removeNotificationToken(userId) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      fcmToken: deleteField() // This completely removes the token field from the database
    });
    console.log("Token securely removed on logout.");
  } catch (error) {
    console.error("Error removing token:", error);
  }
}

// --- NEW: Kind Points Synchronization ---
/**
 * Updates a user's total KindPoints (KindPoints) in Firestore.
 * @param {string} userId - The UID of the user.
 * @param {number} newTotalPoints - The newly calculated point total.
 */
export async function syncKindPoints(userId, newTotalPoints) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      kindPoints: newTotalPoints,
      lastPointSync: new Date().toISOString() // Useful for debugging when points were last saved
    });
  } catch (error) {
    console.error("Error syncing hero points to DB:", error);
    throw error;
  }
}