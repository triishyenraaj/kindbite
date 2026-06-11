// src/utils/scoring.js

export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999; 
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
}

// 🌟 ADDED anchorLocation = null TO PARAMETERS
export function calculateMatchScore(donation, userProfile, anchorLocation = null) {
  if (!userProfile) return { score: 0, distance: 999, isUrgent: false };

  let score = 0;
  let isUrgent = false;

  // 1. Urgency Check
  if (donation.expiryDateTime) {
    const hoursUntilExpiry = (new Date(donation.expiryDateTime).getTime() - new Date().getTime()) / (1000 * 60 * 60);
    if (hoursUntilExpiry <= 0) return { score: 0, distance: 0 }; 
    if (hoursUntilExpiry <= 3) {
      score += 20;
      isUrgent = true;
    } else if (hoursUntilExpiry <= 12) {
      score += 10;
    }
  }

  // 2. Distance Check
  const maxRadius = Math.max(1, userProfile.preferences?.radiusKm || 10); 
  const bufferRadius = maxRadius + 2; 

  // 🌟 ADDED: Dynamic target coordinates (uses anchorLocation if available, else falls back to profile)
  const targetLat = anchorLocation?.lat || userProfile.latitude;
  // Note: Checks both .lon and .lng just to be extra safe with different map APIs
  const targetLon = anchorLocation?.lon || anchorLocation?.lng || userProfile.longitude;

  // 🌟 MODIFIED: Passed targetLat and targetLon instead of userProfile
  const distance = calculateDistance(donation.latitude, donation.longitude, targetLat, targetLon);
  
  if (distance <= maxRadius) {
    const distanceScore = 40 * (1 - (distance / maxRadius));
    score += Math.max(0, distanceScore);
  } else if (distance <= bufferRadius) {
    score += 5; 
  } else {
    return { score: 0, distance }; 
  }

  // 3. Quantity Check
  const requiredPax = userProfile.preferences?.quantity || 1;
  const availablePax = donation.quantity || 1;
  
  if (availablePax >= requiredPax) {
    score += 20; 
  } else if (availablePax >= requiredPax - 1 && requiredPax > 1) {
    score += 10; 
  } else {
    return { score: 0, distance }; 
  }

  // 4. Dietary Tags
  const userTags = userProfile.preferences?.foodTags || [];
  const donationTags = donation.foodTags || [];
  
  if (userTags.includes("No Restrictions") || userTags.length === 0) {
    score += 20; 
  } else {
    const matchedTags = userTags.filter(tag => donationTags.includes(tag));
    if (matchedTags.length > 0) {
      score += (matchedTags.length / userTags.length) * 20;
    } else {
      return { score: 0, distance }; 
    }
  }

  return { score: Math.round(score), distance, isUrgent };
}