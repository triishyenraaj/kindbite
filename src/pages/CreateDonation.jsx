import { useNavigate } from "react-router-dom";
import DonationForm from "@/features/donations/DonationForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreateDonation() {
  const navigate = useNavigate();

  return (
    /* FIXED: Changed max-w-lg to max-w-2xl. 
       This makes the form wider and more comfortable on laptops 
       without stretching the input boxes across the whole screen! 
       Also added md:px-8 for better side spacing.
    */
    <div className="mx-auto max-w-2xl py-6 px-4 md:px-8 space-y-6 pb-24 min-h-screen">
      
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)} 
        className="text-slate-500 hover:text-violet-600 -ml-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Feed
      </Button>

      {/* When the form finishes saving, it will trigger this onCreated function,
        which tells the router to instantly take the user back to the Feed!
      */}
      <DonationForm onCreated={() => navigate("/donations")} />
      
    </div>
  );
}