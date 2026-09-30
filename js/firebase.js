// ============================================
// 🔥 FIREBASE CONFIGURATION (Secret-x)
// Compat format (index.html ke CDN scripts ke liye perfect)
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyCX9myU2sx-LCyGAUsKuVEOJJXo7jhurdg",
  authDomain: "secret-x-c3045.firebaseapp.com",
  projectId: "secret-x-c3045",
  storageBucket: "secret-x-c3045.firebasestorage.app",
  messagingSenderId: "116252360970",
  appId: "1:116252360970:web:98622eb77bf5646c89baf3"
};

// Initialize Firebase (Compat syntax)
firebase.initializeApp(firebaseConfig);

// Global References (Taaki baaki files mein use ho sake)
const auth = firebase.auth();
const db = firebase.firestore();

// Offline Persistence Enable karna (Optional but recommended)
db.enablePersistence()
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence sirf ek tab mein enable ho sakta hai.');
    } else if (err.code === 'unimplemented') {
      console.warn('Yeh browser persistence support nahi karta.');
    }
  });

console.log('🔥 Firebase Secret-x ke liye successfully initialize ho gaya!');
