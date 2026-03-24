import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DonationForm from "@/features/donations/DonationForm";
import { getDonationById } from "@/features/donations/donationService";
import { useAuth } from "@/features/auth/useAuth";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function EditDonation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [donationData, setDonationData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load the existing donation data when the page opens
  useEffect(() => {
    async function loadData() {
      try {
        const data = await getDonationById(id);
        
        // SECURITY CHECKS
        if (!data) return navigate("/donations");
        if (data.donorId !== user.uid) return navigate(`/donations/${id}`);
        if (data.status !== "available") return navigate(`/donations/${id}`);

        // Save the data to pass into the form
        setDonationData({ id, ...data });
      } catch (err) {
        console.error("Error loading for edit:", err);
        alert("Failed to load donation details.");
      } finally {
        setLoading(false);
      }
    }
    
    if (user) loadData();
  }, [id, user, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-4 px-2 pb-20 space-y-4">
      
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)} 
        className="text-slate-500 hover:text-violet-600 -ml-2 font-bold"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Details
      </Button>

      {/* We use your exact same form, but we pass it the existing data!
        When it finishes saving, we send them back to the Details page.
      */}
      <DonationForm 
        initialData={donationData} 
        onCreated={() => navigate(`/donations/${id}`)} 
      />
      
    </div>
  );
}