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

export async function uploadDonationImages(uid, files = []) {
  const urls = [];
  for (const file of files) {
    const fileRef = ref(storage, `donations/${uid}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    urls.push(downloadURL);
  }
  return urls;
}

export async function createDonation(data) {
  const donationData = {
    donorId: data.donorId,
    donorName: data.donorName || "",
    contactNumber: data.contactNumber || "",
    foodName: data.foodName || "",
    description: data.description || "",
    foodType: data.foodType || "Other",
    foodTags: data.foodTags || [],
    quantity: Number(data.quantity) || 1,
    quantityUnit: data.quantityUnit || "pax",
    expiryDateTime: data.expiryDateTime || "",
    address: data.address || "",
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    imageURLs: data.imageURLs || [],
    status: data.status || "available",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "donations"), donationData);
  return docRef.id;
}

export async function getAllDonations() {
  const q = query(collection(db, "donations"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}

export async function getDonationById(id) {
  const donationRef = doc(db, "donations", id);
  const snapshot = await getDoc(donationRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * 🌟 UPGRADED: Atomic Reservation
 * Handles the Reservation logic and prevents double-booking
 */
export async function reserveDonation(id, recipientId, recipientName, recipientPhone) {
  const donationRef = doc(db, "donations", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(donationRef);
    
    if (!docSnap.exists()) {
      throw new Error("This donation no longer exists.");
    }

    // 🛑 CRITICAL CHECK: Make sure it's actually still available!
    if (docSnap.data().status !== "available") {
      throw new Error("Too late! Someone else just reserved this food.");
    }

    // If safe, execute the write
    transaction.update(donationRef, {
      status: "reserved",
      recipientId, 
      recipientName,  
      recipientPhone, 
      reservedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * 🌟 UPGRADED: Atomic Collection
 * Step 3: Recipient confirms they have the food (MANUAL FALLBACK)
 * Status: reserved -> collected
 */
export async function markAsCollected(id, currentUserId) {
  const donationRef = doc(db, "donations", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(donationRef);
    
    if (!docSnap.exists()) {
      throw new Error("Donation not found.");
    }
    
    if (docSnap.data().recipientId !== currentUserId) {
      throw new Error("Security Alert: Only the reserved recipient can collect this.");
    }

    if (docSnap.data().status !== "reserved") {
      throw new Error("This food is not currently reserved.");
    }

    transaction.update(donationRef, {
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
  const donationRef = doc(db, "donations", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(donationRef);
    
    if (!docSnap.exists()) {
      throw new Error("Donation not found.");
    }
    
    // SECURITY: Only the person who POSTED the food can finish the deal manually
    if (docSnap.data().donorId !== currentUserId) {
      throw new Error("Security Alert: Only the donor can complete this donation manually.");
    }

    transaction.update(donationRef, {
      status: "completed",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// 🌟 The Secure QR Handover Shortcut 🌟
/**
 * 🌟 UPGRADED: Atomic QR Completion
 * Fast-tracks a donation straight to "completed" via QR Mutual Consent
 * Status: reserved -> completed
 */
export async function completeViaQR(id, currentUserId) {
  const donationRef = doc(db, "donations", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(donationRef);
    
    if (!docSnap.exists()) {
      throw new Error("Donation not found.");
    }
    
    // SECURITY: Ensure the person who scanned the QR is actually the authorized recipient
    if (docSnap.data().recipientId !== currentUserId) {
      throw new Error("Security Alert: Only the authorized recipient can scan this QR code.");
    }

    if (docSnap.data().status !== "reserved") {
      throw new Error("This food must be in 'Reserved' status to use the QR scanner.");
    }

    // We update both timestamps so your UI timeline lights up perfectly
    transaction.update(donationRef, {
      status: "completed",
      collectedAt: serverTimestamp(), 
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      handoverMethod: "QR_SCAN" // Adds a great audit trail for your database!
    });
  });
}

/**
 * Fetch all donations posted by the current user
 */
export async function getUserDonations(uid) {
  const q = query(collection(db, "donations"), where("donorId", "==", uid));
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return results.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
}

/**
 * Fetch all donations reserved or collected by the current user
 */
export async function getUserRescues(uid) {
  const q = query(collection(db, "donations"), where("recipientId", "==", uid));
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return results.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
}

/**
 * 🌟 UPGRADED: Atomic Un-reserve
 * Cancels a reservation
 * Resets status to available and removes recipient data
 */
export async function unreserveDonation(id) {
  const donationRef = doc(db, "donations", id);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(donationRef);
    
    if (!docSnap.exists()) {
      throw new Error("Donation not found.");
    }

    transaction.update(donationRef, {
      status: "available",
      recipientId: null,
      recipientName: null,
      recipientPhone: null,
      reservedAt: null,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Cancels a donation completely (Donor action)
 * Status: available -> cancelled
 */
export async function cancelDonation(id) {
  const donationRef = doc(db, "donations", id);
  await updateDoc(donationRef, {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Updates an existing donation's details
 */
export async function updateDonation(id, updatedData) {
  const donationRef = doc(db, "donations", id);
  await updateDoc(donationRef, {
    ...updatedData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Automatically sets a donation to expired
 */
export async function expireDonation(id) {
  const donationRef = doc(db, "donations", id);
  await updateDoc(donationRef, {
    status: "expired",
    expiredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// 🛑 GOD MODE: Admin Soft Delete
export const adminRemoveDonation = async (donationId) => {
  try {
    const docRef = doc(db, "donations", donationId);
    await updateDoc(docRef, { 
      status: "removed",
      removedAt: new Date(), 
      updatedAt: serverTimestamp(),
      moderatedBy: "admin" 
    });
  } catch (error) {
    console.error("Error removing donation:", error);
    throw error;
  }
};