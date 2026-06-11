import React, { useState, useEffect } from "react";
import { Star, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "./reviewService";
import { getUserProfile } from "@/features/users/userService";

export default function ReviewModal({ isOpen, onClose, data, currentUser, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [realName, setRealName] = useState("Anonymous");

  useEffect(() => {
    const fetchRealName = async () => {
      if (isOpen && currentUser?.uid) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          if (profile?.fullName) {
            setRealName(profile.fullName);
          }
        } catch (error) {
          console.error("Failed to fetch user profile for review:", error);
        }
      }
    };
    fetchRealName();
  }, [isOpen, currentUser]);

  if (!isOpen || !data) return null;

  // --- NEW LOGIC: Identify Flow Type ---
  // In your services: Requests use 'requesterId', Donations use 'recipientId'
  const isRequestFlow = !!data.requesterId;
  const flowType = isRequestFlow ? "request" : "donation";

  // --- LOGIC: Identify Roles (Giver vs Receiver) ---
  // donorId is used in both services to represent the person GIVING food.
  const giverId = data.donorId; 
  const receiverId = isRequestFlow ? data.requesterId : data.recipientId;
  
  const giverName = data.donorName;
  const receiverName = isRequestFlow ? data.requesterName : data.recipientName;
  
  const transactionTitle = data.foodName || "Food Item";

  // Is current user the one who provided/is providing the food?
  const isGiver = currentUser.uid === giverId;
  
  const revieweeId = isGiver ? receiverId : giverId;
  const revieweeName = isGiver ? receiverName : giverName;
  
  // Explicitly define the reviewer's role for the Reputation system
  const reviewerRole = isGiver ? "donor" : "recipient";

  const handleClose = () => {
    setRating(0);
    setHover(0);
    setComment("");
    onClose(); 
  };

  const handleSubmit = async () => {
    if (rating === 0) return alert("Please select a rating!");

    setIsSubmitting(true);
    try {
      await submitReview({
        flowType: flowType,                      // NEW
        donationId: !isRequestFlow ? data.id : null, // Specific field
        requestId: isRequestFlow ? data.id : null,   // Specific field
        transactionTitle: transactionTitle,      // Renamed from donationTitle
        reviewerId: currentUser.uid,
        reviewerName: realName,
        reviewerRole: reviewerRole, 
        revieweeId,
        revieweeName,
        rating,
        comment,
      });
      onSuccess(); 
      handleClose();
    } catch (error) {
      console.error(error);
      alert("Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl relative">
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center space-y-4 pt-4">
          <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <Star className="w-8 h-8 fill-current" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900">Rate the experience</h2>
          <p className="text-slate-500 text-sm">
            How was your interaction with <span className="font-bold text-slate-700">{revieweeName}</span>?
          </p>
          
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
                className="transition-transform active:scale-90"
              >
                <Star 
                  className={`w-10 h-10 ${
                    (hover || rating) >= star ? "fill-amber-400 text-amber-400" : "text-slate-200"
                  } transition-colors`} 
                />
              </button>
            ))}
          </div>

          <Textarea 
            placeholder="Write a quick comment (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="rounded-2xl border-slate-200 min-h-[100px] focus:ring-violet-500"
          />

          <Button 
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            className="w-full h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Review"}
          </Button>
        </div>
      </div>
    </div>
  );
}