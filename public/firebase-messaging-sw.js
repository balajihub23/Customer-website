importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  "apiKey": "AIzaSyAkQ6ZcQwz6kV0MiTo3WFUn5DEPu7WE6HM",
  "authDomain": "rentron-d43bf.firebaseapp.com",
  "projectId": "rentron-d43bf",
  "storageBucket": "rentron-d43bf.firebasestorage.app",
  "messagingSenderId": "186527279539",
  "appId": "1:186527279539:web:b96e9a44ce5b8e748243c6",
  "measurementId": "G-65H0KVE1NY"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Rentron Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
