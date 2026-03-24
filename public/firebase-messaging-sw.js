importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

try {
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyBl4n35lHVR9EHS_fi7slR28xIJeMoFM4k",
      authDomain: "crypto-explorer-2137.firebaseapp.com",
      projectId: "crypto-explorer-2137",
      storageBucket: "crypto-explorer-2137.firebasestorage.app",
      messagingSenderId: "970851515463",
      appId: "1:970851515463:web:3b3d9c44b4367a373cc562"
    });
  }

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || 'OntyFi';
    const options = {
      body: payload?.notification?.body || '',
      icon: '/favicon.ico',
      data: payload?.data || {}
    };

    self.registration.showNotification(title, options);
  });
} catch (e) {
  // ignore
}

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification?.data && event.notification.data.url) ? event.notification.data.url : '/';
  event.waitUntil(clients.openWindow(url));
});
