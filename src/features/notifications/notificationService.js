import { db } from "@/services/firebase/config";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc,
  limit
} from "firebase/firestore";

// 1. Real-time listener for the current user's notifications
export const listenToNotifications = (userId, callback) => {
  if (!userId) return () => {};

  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(20) // Only fetch the 20 most recent to keep it fast
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(notifications);
  });
};

// 2. Mark a single notification as read
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notifRef = doc(db, "notifications", notificationId);
    await updateDoc(notifRef, { isRead: true });
  } catch (error) {
    console.error("Error marking notification read:", error);
  }
};