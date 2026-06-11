const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

// ==========================================
// HELPER 1: Distance Calculator (Haversine)
// ==========================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999; 
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
}

// ==========================================
// HELPER 2: The 100-Point Scoring Engine (V3.2 - With Buffers)
// ==========================================
function calculateMatchScore(donation, userProfile) {
  let score = 0;

  // 1. Urgency & Ghost Food Check (Max 20 points)
  let isUrgent = false;
  if (donation.expiryDateTime) {
    let timeString = donation.expiryDateTime;
    // Apply the same timezone patch used in the cron jobs
    if (typeof timeString === 'string' && timeString.length === 16) {
        timeString += "+08:00";
    }
    
    const hoursUntilExpiry = (new Date(timeString).getTime() - new Date().getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilExpiry <= 0) return { score: 0, distance: 0 }; 
    
    if (hoursUntilExpiry <= 3) {
      score += 20;
      isUrgent = true;
    } else if (hoursUntilExpiry <= 12) {
      score += 10;
    }
  }

  // 2. Distance Score with 2km Buffer (Max 40 points)
  const maxRadius = Math.max(1, userProfile.preferences?.radiusKm || 10); 
  const bufferRadius = maxRadius + 2; 
  const distance = calculateDistance(donation.latitude, donation.longitude, userProfile.latitude, userProfile.longitude);
  
  if (distance <= maxRadius) {
    const distanceScore = 40 * (1 - (distance / maxRadius));
    score += Math.max(0, distanceScore);
  } else if (distance <= bufferRadius) {
    score += 5; 
  } else {
    return { score: 0, distance }; 
  }

  // 3. Quantity Check with Buffer (Max 20 points)
  const requiredPax = userProfile.preferences?.quantity || 1;
  const availablePax = donation.quantity || 1;
  
  if (availablePax >= requiredPax) {
    score += 20; 
  } else if (availablePax >= requiredPax - 1 && requiredPax > 1) {
    score += 10; 
  } else {
    return { score: 0, distance }; 
  }

  // 4. Dietary Tags (Max 20 points - Scaled)
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

// ==========================================
// TRIGGER 1: THE WATCHDOG (Matchmaker)
// ==========================================
exports.onNewDonation = functions.firestore
  .document("donations/{donationId}")
  .onCreate(async (snap, context) => {
    
    const donation = snap.data();
    const db = admin.firestore();
    const donationId = snap.id;
    console.log(`New donation detected: ${donation.foodName}`);

    const usersSnapshot = await db.collection("users").get();
    
    // 🌟 CHANGE 1: We rename this to actionPromises because it now holds BOTH push and DB writes
    const actionPromises = []; 

    usersSnapshot.forEach((doc) => {
      const user = doc.data();

      if (!user.fcmToken || !user.latitude || !user.longitude || user.uid === donation.donorId) return;

      const matchData = calculateMatchScore(donation, user);

      if (matchData.score >= 50) {
        console.log(`Solid Match for ${user.fullName}! Score: ${matchData.score}/100`);

        let titlePrefix = "👍 ";
        if (matchData.score >= 80) titlePrefix = "🔥 Perfect Match: ";
        if (matchData.isUrgent) titlePrefix = "🚨 URGENT: ";

        const bodyUrgencyText = matchData.isUrgent ? " Expiring very soon! " : " ";
        
        const titleText = `${titlePrefix}${matchData.score}% Match!`;
        const bodyText = `${donation.foodName} (Feeds ${donation.quantity}).${bodyUrgencyText}Just ${matchData.distance.toFixed(1)}km away.`;

        // 🌟 CHANGE 2: Save to the notifications database table!
        const dbPromise = db.collection("notifications").add({
          userId: user.uid,
          title: titleText,
          message: bodyText,
          type: "match_found",
          referenceId: donationId,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 🌟 CHANGE 3: The existing FCM Push Notification
        const pushPromise = admin.messaging().send({
          data: { 
            title: titleText, 
            body: bodyText,
            clickUrl: `/donations/${donationId}` // Updates click URL directly to the item
          },
          token: user.fcmToken 
        }).catch(err => console.error("Push failed for user", user.uid, err));

        actionPromises.push(dbPromise, pushPromise);

      } else if (matchData.score > 0) {
        console.log(`${user.fullName} scored ${matchData.score}, skipping notification to prevent spam.`);
      }
    });

    if (actionPromises.length > 0) {
      await Promise.all(actionPromises);
      console.log(`Successfully executed ${actionPromises.length} notification actions.`);
    } else {
      console.log("No valid quality matches found for this donation.");
    }

    return null;
  });

// ==========================================
// 🌟 NEW TRIGGER 2: DONATION STATUS CHANGE TRACKER
// ==========================================
exports.onDonationStatusChange = functions.firestore
  .document("donations/{donationId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const donationId = context.params.donationId;
    const db = admin.firestore();

    // If status didn't change, we don't care. Exit early.
    if (before.status === after.status) return null;

    let targetUserId = null;
    let title = "";
    let message = "";

    // Determine WHO to notify and WHAT to say based on the status change
    if (after.status === "reserved") {
      targetUserId = after.donorId; // Notify Donor
      title = "📦 Food Reserved!";
      message = `${after.recipientName || "Someone"} has reserved your ${after.foodName}.`;
    } 
    else if (after.status === "collected") {
      targetUserId = after.donorId; // Notify Donor
      title = "🏃 Food Collected";
      message = `${after.recipientName || "The recipient"} has picked up ${after.foodName}. Please confirm handover!`;
    } 
    else if (after.status === "completed") {
      targetUserId = after.recipientId; // Notify Recipient
      title = "✅ Handover Complete";
      message = `The donor finalized the handover for ${after.foodName}. Tap here to leave a quick review!`;
    } 
    else if (after.status === "available" && before.status === "reserved") {
      targetUserId = after.donorId; // Notify Donor
      title = "🔄 Reservation Cancelled";
      message = `The reservation for ${after.foodName} was cancelled. It is public again.`;
    }

    // If we have a target user to notify, execute the DB write & Push Notification concurrently
    if (targetUserId) {
      const actionPromises = [];

      // 1. Write to DB
      const dbPromise = db.collection("notifications").add({
        userId: targetUserId,
        title: title,
        message: message,
        type: "status_update",
        referenceId: donationId,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      actionPromises.push(dbPromise);

      // 2. Fetch User Token & Send Push
      const userDoc = await db.collection("users").doc(targetUserId).get();
      if (userDoc.exists && userDoc.data().fcmToken) {
        const pushPromise = admin.messaging().send({
          data: {
            title: title,
            body: message,
            clickUrl: `/donations/${donationId}`
          },
          token: userDoc.data().fcmToken
        }).catch(e => console.error("Status Update Push Error:", e));
        
        actionPromises.push(pushPromise);
      }

      await Promise.all(actionPromises);
      console.log(`Status update notification sent to ${targetUserId} for status: ${after.status}`);
    }

    return null;
  });

// ==========================================
// 🌟 NEW TRIGGER 3: REQUEST STATUS CHANGE TRACKER
// ==========================================
exports.onRequestStatusChange = functions.firestore
  .document("requests/{requestId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const requestId = context.params.requestId;
    const db = admin.firestore();

    // If status didn't change, we don't care. Exit early.
    if (before.status === after.status) return null;

    let targetUserId = null;
    let title = "";
    let message = "";

    // Determine WHO to notify and WHAT to say based on the request status change
    if (after.status === "fulfilled") {
      targetUserId = after.requesterId; // Notify Requester
      title = "🙏 Request Accepted!";
      message = `${after.donorName || "Someone"} has offered to fulfill your request for ${after.foodName}.`;
    } 
    else if (after.status === "collected") {
      targetUserId = after.donorId; // Notify Donor
      title = "🤝 Requested Food Collected";
      message = `${after.requesterName || "The requester"} has picked up ${after.foodName}. Please confirm handover!`;
    } 
    else if (after.status === "completed") {
      targetUserId = after.requesterId; // Notify Requester
      title = "✅ Request Complete";
      message = `The handover for ${after.foodName} is finalized. Tap here to leave a quick review!`;
    } 
    else if (after.status === "open" && before.status === "fulfilled") {
      targetUserId = after.requesterId; // Notify Requester
      title = "🔄 Fulfillment Cancelled";
      message = `The donor had to cancel their fulfillment for ${after.foodName}. Your request is public again.`;
    }

    // If we have a target user to notify, execute the DB write & Push Notification concurrently
    if (targetUserId) {
      const actionPromises = [];

      // 1. Write to Notifications DB
      const dbPromise = db.collection("notifications").add({
        userId: targetUserId,
        title: title,
        message: message,
        type: "status_update", // Using the same type so your React UI renders the Package icon!
        referenceId: requestId,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      actionPromises.push(dbPromise);

      // 2. Fetch User Token & Send Push
      const userDoc = await db.collection("users").doc(targetUserId).get();
      if (userDoc.exists && userDoc.data().fcmToken) {
        const pushPromise = admin.messaging().send({
          data: {
            title: title,
            body: message,
            clickUrl: `/requests/${requestId}` // Pointing to the requests route!
          },
          token: userDoc.data().fcmToken
        }).catch(e => console.error("Request Status Update Push Error:", e));
        
        actionPromises.push(pushPromise);
      }

      await Promise.all(actionPromises);
      console.log(`Request status notification sent to ${targetUserId} for status: ${after.status}`);
    }

    return null;
  });

// ==========================================
// THE CLEANER: Auto-Expires Food Every 5 Mins (Bulletproof Version)
// ==========================================
exports.autoExpireDonations = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date(); 

    const activeQuery = await db.collection("donations")
      .where("status", "in", ["available", "reserved"]) 
      .get();

    if (activeQuery.empty) {
      console.log("No active donations to check.");
      return null;
    }

    const batch = db.batch();
    let expiredCount = 0;

    activeQuery.forEach((doc) => {
      const data = doc.data();
      
      if (data.expiryDateTime) {
        let expiryDate;
        
        if (data.expiryDateTime.toDate) {
          expiryDate = data.expiryDateTime.toDate();
        } else {
          let timeString = data.expiryDateTime;
          if (timeString.length === 16) { 
            timeString += "+08:00"; 
          }
          expiryDate = new Date(timeString);
        }
        
          if (now > expiryDate) {
          batch.update(doc.ref, { 
            status: "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          expiredCount++;
        }
      }
    });

    if (expiredCount > 0) {
      await batch.commit();
      console.log(`Successfully expired ${expiredCount} donations.`);
    } else {
      console.log("Checked all active food, none are expired yet.");
    }

    return null;
  });

// ==========================================
// THE CLEANER 2: Auto-Expires Requests Every 5 Mins
// ==========================================
exports.autoExpireRequests = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date(); 

    const activeQuery = await db.collection("requests")
      .where("status", "in", ["open", "fulfilled"]) 
      .get();

    if (activeQuery.empty) {
      console.log("No active requests to check.");
      return null;
    }

    const batch = db.batch();
    let expiredCount = 0;

    activeQuery.forEach((doc) => {
      const data = doc.data();
      
      if (data.expiryDateTime) {
        let expiryDate;
        
        if (data.expiryDateTime.toDate) {
          expiryDate = data.expiryDateTime.toDate();
        } else {
          let timeString = data.expiryDateTime;
          if (timeString.length === 16) { 
            timeString += "+08:00"; 
          }
          expiryDate = new Date(timeString);
        }
        
        if (now > expiryDate) {
          batch.update(doc.ref, { 
            status: "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          expiredCount++;
        }
      }
    });

    if (expiredCount > 0) {
      await batch.commit();
      console.log(`Successfully expired ${expiredCount} requests.`);
    } else {
      console.log("Checked all active requests, none are expired yet.");
    }

    return null;
  });

// ==========================================
// THE METRICS CALCULATOR (Real Impact, Supply/Demand, Hotspots):
// ==========================================
const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.generateDailyChartData = onSchedule({
  schedule: "00 00 * * *", 
  timeZone: "Asia/Kuala_Lumpur" 
}, async (event) => {
  const db = admin.firestore();
  
  // Since cron triggers at exactly 00:00 MYT, "now" is the absolute start of our current day
  const now = new Date(); 
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Covers today + last 6 days

  const [
    completedDonations, 
    completedRequests, 
    recentDonations, 
    recentRequests,
    totalUsersCount
  ] = await Promise.all([
    db.collection("donations").where("status", "==", "completed").get(),
    db.collection("requests").where("status", "==", "completed").get(),
    db.collection("donations").where("createdAt", ">=", sevenDaysAgo).get(),
    db.collection("requests").where("createdAt", ">=", sevenDaysAgo).get(),
    db.collection("users").count().get() 
  ]);

  // ==========================================
  // PART A: LIFETIME IMPACT & UNIQUE USERS
  // ==========================================
  let totalMealsAllTime = 0;
  let uniquePeopleSet = new Set();

  const processCompleted = (doc) => {
    const data = doc.data();
    totalMealsAllTime += (Number(data.quantity) || 1);
    if (data.donorId) uniquePeopleSet.add(data.donorId);
    if (data.recipientId) uniquePeopleSet.add(data.recipientId);
    if (data.requesterId) uniquePeopleSet.add(data.requesterId);
  };

  completedDonations.forEach(processCompleted);
  completedRequests.forEach(processCompleted);

  const co2Total = totalMealsAllTime * 1.25;
  const impactData = {
    totalMeals: totalMealsAllTime,
    co2SavedKg: Math.round(co2Total),
    waterSavedLiters: totalMealsAllTime * 800,
    valueSavedRM: totalMealsAllTime * 10,
    treesEquivalent: Math.round(co2Total / 20),
    uniquePeople: uniquePeopleSet.size,
    totalRegisteredUsers: totalUsersCount.data().count,
    wastePreventedKg: totalMealsAllTime * 0.5 
  };

  // ==========================================
  // PART B: PERFECT MIDNIGHT BUCKETS & HOTSPOTS
  // ==========================================
  
  // 🌟 NEW: Helper to generate a bulletproof MYT YYYY-MM-DD string for grouping
  const getMYTDateKey = (dateObj) => {
    return new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(dateObj);
  };

  // Create exactly 7 empty buckets starting from Today, stepping backward
  let weeklyData = Array.from({length: 7}).map((_, i) => {
    const bucketDate = new Date(now);
    bucketDate.setDate(bucketDate.getDate() - (6 - i)); 
    
    // 🌟 FIX: Force UI labels to render strictly in Malaysia Time
    const fullDateString = bucketDate.toLocaleDateString('en-MY', { 
      timeZone: 'Asia/Kuala_Lumpur',
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
    });
    
    // 🌟 FIX: Extract the correct MYT Day Name (Mon, Tue, etc.)
    const dayName = new Intl.DateTimeFormat('en-MY', { 
      timeZone: 'Asia/Kuala_Lumpur', weekday: 'short' 
    }).format(bucketDate);

    return { 
      name: dayName, 
      fullDate: fullDateString, 
      dateKey: getMYTDateKey(bucketDate), // Match by strict string, not messy UTC timestamps
      volume: 0, supply: 0, demand: 0 
    };
  });

  let locationCounts = {};

  const extractCity = (address) => {
    if (!address) return "Unknown Area";
    const parts = address.split(',').map(p => p.trim());
    if (parts.length > 0) {
      if (parts[parts.length - 1].toLowerCase() === 'malaysia') parts.pop();
      if (parts.length > 0) {
        let cityPart = parts.length > 1 ? parts[parts.length - 2] : parts[0];
        let city = cityPart.replace(/\b\d{5}\b/g, '').trim(); 
        if (!city && parts.length > 0) city = parts[parts.length - 1].trim(); 
        return city || "Unknown Area";
      }
    }
    return "Unknown Area";
  };

  const processItemForCharts = (doc, type) => {
    const data = doc.data();
    if (!data.createdAt || !data.createdAt.toDate) return;
    
    // 🌟 FIX: Convert the item's created UTC timestamp directly into a MYT YYYY-MM-DD string
    const itemDateKey = getMYTDateKey(data.createdAt.toDate());
    
    // Find the exact matching bucket
    const targetBucket = weeklyData.find(b => b.dateKey === itemDateKey);
    
    if (targetBucket) {
      if (type === 'supply') targetBucket.supply += 1;
      if (type === 'demand') targetBucket.demand += 1;
      if (data.status === "completed") targetBucket.volume += (Number(data.quantity) || 1);
    }

    if (type === 'supply') {
      const city = extractCity(data.address);
      locationCounts[city] = (locationCounts[city] || 0) + 1;
    }
  };

  recentDonations.forEach(doc => processItemForCharts(doc, 'supply'));
  recentRequests.forEach(doc => processItemForCharts(doc, 'demand'));

  // Sort areas by most donations and take the top 5
  const hotspots = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area, count]) => ({ name: area, value: count }));

  // ==========================================
  // SAVE TO DATABASE
  // ==========================================
  await db.collection("analytics").doc("dashboard_chart").set({
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    impact: impactData,     
    weeklyStats: weeklyData, 
    hotspots: hotspots       
  }, { merge: true });      

  console.log("Successfully generated Unified Analytics Payload!");
});

// ==========================================
// 🌟 NEW TRIGGER 4: NEW REPORT ALERT (Notifies Admins)
// ==========================================
exports.onNewReport = functions.firestore
  .document("reports/{reportId}")
  .onCreate(async (snap, context) => {
    const report = snap.data();
    const db = admin.firestore();

    console.log(`New report filed by ${report.reporterName} for ${report.issueType}`);

    const adminsSnapshot = await db.collection("users").where("role", "==", "admin").get();
    
    if (adminsSnapshot.empty) return null;

    const actionPromises = [];
    const title = "⚠️ New Moderation Report";
    const message = `${report.reporterName} flagged a ${report.issueType} issue. Action required.`;

    adminsSnapshot.forEach((doc) => {
      const adminUser = doc.data();

      // 1. Write to Notifications DB
      const dbPromise = db.collection("notifications").add({
        userId: adminUser.uid,
        title: title,
        message: message,
        type: "admin_alert", 
        referenceId: context.params.reportId, // Admins use the Report ID
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      actionPromises.push(dbPromise);

      // 2. Send Push Notification
      if (adminUser.fcmToken) {
        const pushPromise = admin.messaging().send({
          data: {
            title: title,
            body: message,
            clickUrl: "/admin/dashboard" // 🌟 Corrected to your exact relative route
          },
          token: adminUser.fcmToken
        }).catch(e => console.error(`Push failed for admin ${adminUser.uid}`, e));
        
        actionPromises.push(pushPromise);
      }
    });

    await Promise.all(actionPromises);
    return null;
  });

// ==========================================
// 🌟 NEW TRIGGER 5: REPORT RESOLUTION ALERT (Notifies Reporter)
// ==========================================
exports.onReportStatusChange = functions.firestore
  .document("reports/{reportId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const db = admin.firestore();

    if (before.reportStatus === after.reportStatus) return null;
    if (after.reportStatus !== "resolved" && after.reportStatus !== "dismissed") return null;

    const reporterId = after.reporterId;
    if (!reporterId) return null;

    const isResolved = after.reportStatus === "resolved";
    const title = isResolved ? "✅ Report Resolved" : "🛡️ Report Reviewed";

    // Determine the exact post type for the text scanner
    const postTypeStr = after.requestId ? "request" : "donation";

    // Inject the post type into the message string
    let message = isResolved
      ? `Thank you for keeping KindBite safe! Your report regarding the ${postTypeStr} "${after.postTitle}" has been resolved.`
      : `Your report regarding the ${postTypeStr} "${after.postTitle}" was reviewed by our moderation team and dismissed.`;

    if (after.adminComment) {
      message += ` Admin Note: "${after.adminComment}"`;
    }

    const postReferenceId = after.requestId || after.donationId;
    
    // 🌟 THE FIX: Route the push notification click to the My Reports page
    const clickUrl = `/profile/reports`;

    const actionPromises = [];

    // 1. Write to Notifications DB
    const dbPromise = db.collection("notifications").add({
      userId: reporterId,
      title: title,
      message: message,
      type: "report_update",
      referenceId: postReferenceId, 
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    actionPromises.push(dbPromise);

    // 2. Send Push Notification
    const userDoc = await db.collection("users").doc(reporterId).get();
    if (userDoc.exists && userDoc.data().fcmToken) {
      const pushPromise = admin.messaging().send({
        data: {
          title: title,
          body: message,
          clickUrl: clickUrl 
        },
        token: userDoc.data().fcmToken
      }).catch(e => console.error("Report Status Push Error:", e));
      
      actionPromises.push(pushPromise);
    }

    await Promise.all(actionPromises);
    return null;
  });