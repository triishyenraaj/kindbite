// src/features/donations/DonationList.jsx
import DonationCard from "@/features/donations/DonationCard";
import { UtensilsCrossed, SearchX } from "lucide-react"; 

export default function DonationList({ donations, userLocation, isFiltered }) { 
  if (!donations || donations.length === 0) {
    return (
      /* CRITICAL FIX: Added 'col-span-full' so this empty state fills the whole row on laptops */
      <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
          {/* Swap icon based on whether user is searching or not */}
          {isFiltered ? (
            <SearchX className="w-8 h-8 text-slate-400" />
          ) : (
            <UtensilsCrossed className="w-8 h-8 text-slate-400" />
          )}
        </div>

        <h3 className="text-lg font-semibold text-slate-900">
          {isFiltered ? "No matches found" : "No donations yet"}
        </h3>
        
        <p className="text-slate-500 max-w-sm mt-1">
          {isFiltered 
            ? "Try adjusting your filters or search terms to find what you're looking for." 
            : "Be the first to share surplus food with your community by posting a donation above!"}
        </p>
      </div>
    );
  }

  return (
    /* CRITICAL FIX: Changed from <div className="grid gap-5"> to a Fragment <></> */
    /* This unleashes the cards so the parent component can place them side-by-side */
    <>
      {donations.map((donation) => (
        <DonationCard 
          key={donation.id} 
          donation={donation} 
          userLocation={userLocation} 
        />
      ))}
    </>
  );
}