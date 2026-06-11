// 1. Import the Firebase scripts needed for the background worker
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 2. Initialize the Firebase app in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyB21bCqc82oLvVVY1791PjdLm-mk4Fl2Jw",
  authDomain: "kindbite-90be8.firebaseapp.com",
  projectId: "kindbite-90be8",
  storageBucket: "kindbite-90be8.firebasestorage.app",
  messagingSenderId: "375981517036",
  appId: "1:375981517036:web:6de94a5b4511b110411dc9"
};

firebase.initializeApp(firebaseConfig);

// 3. Retrieve an instance of Firebase Messaging so it can handle background messages
const messaging = firebase.messaging();

// 4. Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background data message ', payload);
  
  // 🛑 Look for payload.data now!
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: '/logo.png', 
    data: { url: payload.data.clickUrl } // Pass the URL to the click event
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 5. NEW: Handle what happens when the user clicks the notification!
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Grab the URL from the payload
  const targetUrl = event.notification.data.url || '/donations'; 

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});