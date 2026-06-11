// src/features/requests/requestService.js
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  runTransaction // 🌟 NEW: Imported runTransaction for atomic operations
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/services/firebase/config";

export async function uploadRequestImages(uid, files = []) {
  const urls = [];
  for (const file of files) {
    const fileRef = ref(storage, `requests/${uid}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    urls.push(downloadURL);
  }
  return urls;
}

export async function createRequest(data) {
  const requestData = {
    requesterId: data.requesterId, // The person who NEEDS the food
    requesterName: data.requesterName || "",
    contactNumber: data.contactNumber || "", // Requester's phone number
    foodName: data.foodName || "",
    description: data.description || "",
    foodType: data.foodType || "Other",
    foodTags: data.foodTags || [],
    quantity: Number(data.quantity) || 1,
    quantityUnit: data.quantityUnit || "pax",
    expiryDateTime: data.expiryDateTime || "", // When they need it by
    address: data.address || "",
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    imageURLs: data.imageURLs || [],
    status: data.status || "open", // Matches the "Posted" state
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "requests"), requestData);
  return docRef.id;
}

export async function getAllRequests() {
  const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}

export async function getRequestById(id) {
  const requestRef = doc(db, "requests", id);
  const snapshot = await getDoc(requestRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * 🌟 UPGRADED: Atomic Acceptance
 * Handles the Acceptance logic and prevents double-booking race conditions
 * Records WHICH Donor is stepping up to fulfill the request
 * Status: open -> fulfilled
 */
export async function acceptRequest(id, donorId, donorName, donorPhone) {
  const requestRef = doc(db, "requests", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(requestRef);
    
    if (!docSnap.exists()) {
      throw new Error("This request no longer exists.");
    }

    // 🛑 CRITICAL CHECK: Make sure it's actually still open!
    if (docSnap.data().status !== "open") {
      throw new Error("Too late! Someone else already offered to fulfill this request.");
    }

    // If safe, execute the write atomically
    transaction.update(requestRef, {
      status: "fulfilled", 
      donorId, 
      donorName,  
      donorPhone, 
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * 🌟 UPGRADED: Atomic Collection
 * Step 3: Requester confirms they have received the food (MANUAL FALLBACK)
 * Status: fulfilled -> collected
 */
export async function markAsCollected(id, currentUserId) {
  const requestRef = doc(db, "requests", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(requestRef);
    
    if (!docSnap.exists()) {
      throw new Error("Request not found.");
    }
    
    // Security check remains the same
    if (docSnap.data().requesterId !== currentUserId) {
      throw new Error("Only the requester can mark this as collected.");
    }

    if (docSnap.data().status !== "fulfilled") {
      throw new Error("This request is not currently being fulfilled.");
    }

    transaction.update(requestRef, {
      status: "collected",
      collectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * 🌟 UPGRADED: Atomic Completion
 * Step 4: Donor confirms the handover is total (MANUAL FALLBACK)
 * Status: collected -> completed
 */
export async function markAsCompleted(id, currentUserId) {
  const requestRef = doc(db, "requests", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(requestRef);
    
    if (!docSnap.exists()) {
      throw new Error("Request not found.");
    }
    
    // SECURITY: Only the Donor who stepped up can finish the deal
    if (docSnap.data().donorId !== currentUserId) {
      throw new Error("Only the donor can complete this request.");
    }

    transaction.update(requestRef, {
      status: "completed",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// 🌟 NEW: The Secure QR Handover Shortcut 🌟
/**
 * 🌟 UPGRADED: Atomic QR Completion
 * Fast-tracks a request straight to "completed" via QR Mutual Consent
 * Status: fulfilled -> completed
 */
export async function completeRequestViaQR(id, currentUserId) {
  const requestRef = doc(db, "requests", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(requestRef);
    
    if (!docSnap.exists()) {
      throw new Error("Request not found.");
    }
    
    // SECURITY: Ensure the person who scanned the QR is actually the authorized requester
    if (docSnap.data().requesterId !== currentUserId) {
      throw new Error("Security Alert: Only the authorized requester can scan this QR code.");
    }

    if (docSnap.data().status !== "fulfilled") {
      throw new Error("This request must be in 'Fulfilled' status to use the QR scanner.");
    }

    // We update both timestamps so your UI timeline lights up perfectly
    transaction.update(requestRef, {
      status: "completed",
      collectedAt: serverTimestamp(), 
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      handoverMethod: "QR_SCAN" // Adds a great audit trail for your database!
    });
  });
}

/**
 * Fetch all requests posted by the current user (They are asking for food)
 */
export async function getUserRequests(uid) {
  const q = query(collection(db, "requests"), where("requesterId", "==", uid));
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return results.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
}

/**
 * Fetch all requests the current user has stepped up to fulfill (They are giving food)
 */
export async function getUserFulfillments(uid) {
  const q = query(collection(db, "requests"), where("donorId", "==", uid));
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return results.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
}

/**
 * 🌟 UPGRADED: Atomic Un-fulfill
 * Donor cancels their commitment to provide food
 * Resets status to open and removes donor data
 */
export async function releaseFulfillment(id) {
  const requestRef = doc(db, "requests", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(requestRef);
    
    if (!docSnap.exists()) {
      throw new Error("Request not found.");
    }

    transaction.update(requestRef, {
      status: "open",
      donorId: null,
      donorName: null,
      donorPhone: null,
      acceptedAt: null,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Cancels a request completely (Requester action)
 * Status: open -> cancelled
 */
export async function cancelRequest(id) {
  const requestRef = doc(db, "requests", id);
  await updateDoc(requestRef, {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Updates an existing request's details
 */
export async function updateRequest(id, updatedData) {
  const requestRef = doc(db, "requests", id);
  await updateDoc(requestRef, {
    ...updatedData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Automatically sets a request to expired if the time passes without fulfillment
 */
export async function expireRequest(id) {
  const requestRef = doc(db, "requests", id);
  await updateDoc(requestRef, {
    status: "expired",
    expiredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * ADMIN ONLY: Performs a soft-delete on a request.
 * Changes status to 'removed' so it disappears from the app
 * but remains in the DB for audit/moderation records.
 */
export const adminRemoveRequest = async (requestId) => {
  try {
    const requestRef = doc(db, "requests", requestId);
    
    await updateDoc(requestRef, {
      status: "removed",
      removedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      moderatedBy: "admin" // Useful for your logs!
    });

    return true;
  } catch (error) {
    console.error("Error in adminRemoveRequest:", error);
    throw new Error("Failed to remove request. Please check admin permissions.");
  }
};