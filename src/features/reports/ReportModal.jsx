import React, { useState } from "react";
import { AlertTriangle, Loader2, X, Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { submitReport } from "./reportService";
import { getUserProfile } from "@/features/users/userService"; // 👈 ADDED IMPORT

// 🌟 UPDATED PROPS: Added 'reportedUserId'
export default function ReportModal({ isOpen, onClose, donation, request, currentUser, reportedUserId }) {
  const [issue, setIssue] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 DYNAMIC LOGIC: Determine what type of post we are looking at
  const data = donation || request;
  const isRequest = !!request;

  if (!isOpen || !data) return null;

  const handleClose = () => {
    setIssue("");
    setDescription("");
    setPhotos([]);
    onClose();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 4) {
      alert("You can only upload up to 4 photos.");
      return;
    }
    setPhotos((prev) => [...prev, ...files]);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!issue || !description) return alert("Please fill in all required fields.");
    
    setIsSubmitting(true);
    try {
      // 🌟 STEP 1: Fetch real names from Firestore
      const targetId = reportedUserId || (isRequest ? data.requesterId : data.donorId);
      
      const [reporterProfile, reportedProfile] = await Promise.all([
        getUserProfile(currentUser.uid),
        getUserProfile(targetId)
      ]);

      const reporterName = reporterProfile?.fullName || currentUser.displayName || "User";
      const reportedUserName = reportedProfile?.fullName || "Unknown User";

      // 🌟 STEP 2: Logic for Roles
      let reporterRole = "";
      let reportedUserRole = "";

      if (isRequest) {
        if (currentUser.uid === data.requesterId) {
          reporterRole = "recipient"; reportedUserRole = "donor";     
        } else {
          reporterRole = "donor"; reportedUserRole = "recipient";     
        }
      } else {
        if (currentUser.uid === data.donorId) {
          reporterRole = "donor"; reportedUserRole = "recipient";     
        } else {
          reporterRole = "recipient"; reportedUserRole = "donor";         
        }
      }

      // 🌟 STEP 3: Submit with names
      await submitReport({
        reporterId: currentUser.uid,
        reporterName: reporterName,      // 👈 FETCHED NAME
        reporterRole: reporterRole,
        
        reportedUserId: targetId,
        reportedUserName: reportedUserName, // 👈 ADDED NAME
        reportedUserRole: reportedUserRole,
        
        donationId: isRequest ? null : data.id,
        requestId: isRequest ? data.id : null,
        postTitle: data.foodName, 
        
        issueType: issue,
        description: description,
        reportStatus: "pending",
        platformContext: isRequest ? "request_detail" : "donation_detail" 
      }, photos);

      alert("Thank you. Our moderation team will review this report.");
      handleClose();
    } catch (e) {
      console.error(e);
      alert("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
        
        <button onClick={handleClose} className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 z-10">
          <X className="w-6 h-6" />
        </button>

        <div className="space-y-6 pt-2">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Report Content</h2>
            <p className="text-slate-500 text-sm font-medium px-4">
              Help us keep KindBite safe. What's wrong with this post?
            </p>
          </div>

          <div className="space-y-4">
            {/* Issue Category */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Main Issue</label>
              <Select onValueChange={setIssue} value={issue}>
                <SelectTrigger className="w-full h-12 rounded-2xl border-slate-200 bg-slate-50/50">
                  <SelectValue placeholder="Select an issue type" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[110] w-[var(--radix-select-trigger-width)] rounded-2xl bg-white shadow-xl">
                  <SelectItem value="Food Safety">Food Safety / Expired</SelectItem>
                  <SelectItem value="Hygiene">Poor Hygiene / Tampered</SelectItem>
                  <SelectItem value="No-show">User did not show up</SelectItem>
                  <SelectItem value="Spam">Spam / Misleading Info</SelectItem>
                  <SelectItem value="Inappropriate">Inappropriate Content</SelectItem>
                  <SelectItem value="Other">Other Issues</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Details</label>
              <Textarea 
                placeholder="Describe the issue in detail..." 
                className="rounded-2xl border-slate-200 min-h-[80px] bg-slate-50/50 focus:ring-2 focus:ring-red-500 outline-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Multiple Photo Evidence Section */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Evidence Photos ({photos.length}/4)</label>
              
              <div className="grid grid-cols-4 gap-2">
                {photos.map((file, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="preview" 
                      className="w-full h-full object-cover" 
                    />
                    <button 
                      onClick={() => removePhoto(index)}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                ))}
                
                {photos.length < 4 && (
                  <button 
                    onClick={() => document.getElementById('report-photo').click()}
                    className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl hover:border-red-400 hover:bg-red-50/30 transition-all text-slate-400"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[9px] font-bold mt-1">Add</span>
                  </button>
                )}
              </div>

              <input 
                id="report-photo" 
                type="file" 
                hidden 
                multiple 
                accept="image/*" 
                onChange={handleFileChange} 
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={handleClose} className="flex-1 h-12 rounded-2xl font-bold text-slate-500">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !issue || !description}
              className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Report"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}