import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RequestForm from "@/features/requests/RequestForm";
import { getRequestById } from "@/features/requests/requestService";
import { useAuth } from "@/features/auth/useAuth";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function EditRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load the existing request data when the page opens
  useEffect(() => {
    async function loadData() {
      try {
        const data = await getRequestById(id);
        
        // SECURITY CHECKS
        if (!data) return navigate("/requests");
        
        // Ensure only the person who created the request can edit it
        if (data.requesterId !== user.uid) return navigate(`/requests/${id}`);
        
        // Ensure it can only be edited while it's still "open"
        if (data.status !== "open") return navigate(`/requests/${id}`);

        // Save the data to pass into the form
        setRequestData({ id, ...data });
      } catch (err) {
        console.error("Error loading for edit:", err);
        alert("Failed to load request details.");
      } finally {
        setLoading(false);
      }
    }
    
    if (user) loadData();
  }, [id, user, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    /* Applied the wider, laptop-friendly layout here as well! */
    <div className="mx-auto max-w-2xl py-6 px-4 md:px-8 space-y-6 pb-24 min-h-screen">
      
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)} 
        className="text-slate-500 hover:text-blue-600 -ml-2 font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Details
      </Button>

      {/* We use your exact same form, but we pass it the existing data!
        When it finishes saving, we send them back to the Details page.
      */}
      <RequestForm 
        initialData={requestData} 
        onCreated={() => navigate(`/requests/${id}`)} 
      />
      
    </div>
  );
}