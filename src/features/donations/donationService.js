// src/features/donations/donationService.js
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
 * Handles the Reservation logic
 * Records WHICH user is reserving the food
 */
export async function reserveDonation(id, recipientId, recipientName, recipientPhone) {
  // Added recipientName and recipientPhone above ^
  const donationRef = doc(db, "donations", id);
  await updateDoc(donationRef, {
    status: "reserved",
    recipientId, 
    recipientName,  // Now these variables are defined!
    recipientPhone, 
    reservedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Step 3: Recipient confirms they have the food
 * Status: reserved -> collected
 */
export async function markAsCollected(id, currentUserId) {
  const donationRef = doc(db, "donations", id);
  const snap = await getDoc(donationRef);
  
  if (snap.data().recipientId !== currentUserId) {
    throw new Error("Only the recipient can mark this as collected.");
  }

  await updateDoc(donationRef, {
    status: "collected",
    collectedAt: serverTimestamp(),
  });
}

/**
 * Step 4: Donor confirms the handover is total
 * Status: collected -> completed
 */
export async function markAsCompleted(id, currentUserId) {
  const donationRef = doc(db, "donations", id);
  const snap = await getDoc(donationRef);
  
  // SECURITY: Only the person who POSTED the food can finish the deal
  if (snap.data().donorId !== currentUserId) {
    throw new Error("Only the donor can complete this donation.");
  }

  await updateDoc(donationRef, {
    status: "completed",
    completedAt: serverTimestamp(),
  });
}

/**
 * Fetch all donations posted by the current user
 */
export async function getUserDonations(uid) {
  const q = query(collection(db, "donations"), where("donorId", "==", uid));
  const snapshot = await getDocs(q);
  // Sort by newest first in JavaScript (prevents needing a complex Firestore Index)
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
 * Cancels a reservation
 * Resets status to available and removes recipient data
 */
export async function unreserveDonation(id) {
  const donationRef = doc(db, "donations", id);
  await updateDoc(donationRef, {
    status: "available",
    recipientId: null,
    recipientName: null,
    recipientPhone: null,
    reservedAt: null,
    updatedAt: serverTimestamp(),
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