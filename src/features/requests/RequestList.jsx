// src/features/requests/RequestList.jsx
import RequestCard from "@/features/requests/RequestCard";
import { UtensilsCrossed, SearchX } from "lucide-react"; 

export default function RequestList({ requests, userLocation, isFiltered }) { 
  if (!requests || requests.length === 0) {
    return (
      /* CRITICAL FIX: Added 'col-span-full' so this empty state fills the whole row on laptops */
      /* Updated to use subtle violet tints for the empty state background and border */
      <div className="col-span-full rounded-3xl border border-dashed border-violet-200 bg-violet-50/50 p-10 text-center flex flex-col items-center justify-center">
        {/* Updated icon wrapper to a soft violet */}
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-violet-100">
          {/* Swap icon based on whether user is searching or not. Updated icons to violet! */}
          {isFiltered ? (
            <SearchX className="w-8 h-8 text-violet-400" />
          ) : (
            <UtensilsCrossed className="w-8 h-8 text-violet-400" />
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900">
          {isFiltered ? "No matches found" : "No requests yet"}
        </h3>
        
        <p className="text-slate-500 max-w-sm mt-2 leading-relaxed">
          {isFiltered 
            ? "Try adjusting your filters or search terms to find what you're looking for." 
            : "Be the first to ask for food assistance from your community by posting a request above!"}
        </p>
      </div>
    );
  }

  return (
    /* CRITICAL FIX: Changed from <div className="grid gap-5"> to a Fragment <></> */
    /* This unleashes the cards so the parent component can place them side-by-side */
    <>
      {requests.map((request) => (
        <RequestCard 
          key={request.id} 
          request={request} 
          userLocation={userLocation} 
        />
      ))}
    </>
  );
}