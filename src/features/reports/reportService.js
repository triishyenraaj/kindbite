import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/services/firebase/config";

export const submitReport = async (reportData, imageFiles = []) => {
  try {
    let evidenceURLs = [];

    // 1. Handle Multiple Image Uploads
    if (imageFiles.length > 0) {
      const uploadPromises = imageFiles.map(async (file) => {
        const storageRef = ref(storage, `reports/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
      });
      
      // Wait for all images to finish uploading
      evidenceURLs = await Promise.all(uploadPromises);
    }

    // 2. Save Report to Firestore
    const reportRef = await addDoc(collection(db, "reports"), {
      ...reportData,
      evidenceURLs, // Now storing an array of strings
      createdAt: serverTimestamp(),
    });

    return reportRef.id;
  } catch (error) {
    console.error("Report Submission Error:", error);
    throw error;
  }
};