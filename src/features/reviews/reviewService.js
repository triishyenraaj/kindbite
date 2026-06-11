import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy 
} from "firebase/firestore";
import { db } from "@/services/firebase/config";

/**
 * 1. Saves a new review.
 * Handles both Donation and Request flows explicitly.
 */
export async function submitReview(reviewData) {
  try {
    // Logic: If I am the donor, I am rating a recipient (and vice-versa)
    const revieweeRole = reviewData.reviewerRole === "donor" ? "recipient" : "donor";

    const docRef = await addDoc(collection(db, "reviews"), {
      flowType: reviewData.flowType,             // "donation" or "request"
      donationId: reviewData.donationId || null, // Specific ID for donation flow
      requestId: reviewData.requestId || null,   // Specific ID for request flow
      transactionTitle: reviewData.transactionTitle, 
      
      reviewerId: reviewData.reviewerId,
      reviewerName: reviewData.reviewerName,
      reviewerRole: reviewData.reviewerRole,     // "donor" or "recipient"
      
      revieweeId: reviewData.revieweeId,
      revieweeName: reviewData.revieweeName,
      revieweeRole: revieweeRole,                // "recipient" or "donor"
      
      rating: Number(reviewData.rating),
      comment: reviewData.comment || "",
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error submitting review:", error);
    throw error;
  }
}

/**
 * 2. Check if a user has already left a review for a specific transaction.
 * Dynamically checks donationId or requestId based on flowType.
 */
export async function checkIfReviewed(id, reviewerId, flowType) {
  const idField = flowType === "donation" ? "donationId" : "requestId";

  const q = query(
    collection(db, "reviews"), 
    where(idField, "==", id),
    where("reviewerId", "==", reviewerId)
  );
  
  const snapshot = await getDocs(q);
  return !snapshot.empty; 
}

/**
 * 3. QUERY HELPER: Fetch reviews based on roles and optional flow type.
 */
export async function getFilteredReviews({ reviewerId, reviewerRole, revieweeId, revieweeRole, flowType }) {
  let constraints = [];

  if (reviewerId) constraints.push(where("reviewerId", "==", reviewerId));
  if (reviewerRole) constraints.push(where("reviewerRole", "==", reviewerRole));
  if (revieweeId) constraints.push(where("revieweeId", "==", revieweeId));
  if (revieweeRole) constraints.push(where("revieweeRole", "==", revieweeRole));
  if (flowType) constraints.push(where("flowType", "==", flowType));

  const q = query(collection(db, "reviews"), ...constraints, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * 4. Fetches all reviews for a specific transaction.
 * Works for both flows by checking the appropriate ID field.
 */
export async function getTransactionReviews(id, flowType) {
  const idField = flowType === "donation" ? "donationId" : "requestId";

  const q = query(
    collection(db, "reviews"), 
    where(idField, "==", id),
    orderBy("createdAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * 5. Reputation Calculation
 * Remains unified so Profile Trust Score reflects BOTH flows.
 */
export async function getUserReputation(userId, role) {
  const q = query(
    collection(db, "reviews"), 
    where("revieweeId", "==", userId),
    where("revieweeRole", "==", role)
  );
  
  const snapshot = await getDocs(q);
  const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const total = reviews.length;
  const average = total > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1) 
    : 0;

  return { reviews, average, total };
}