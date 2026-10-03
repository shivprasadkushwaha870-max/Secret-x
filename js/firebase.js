// ============================================
// 🔥 FIREBASE CONFIGURATION (Secret-x)
// ============================================

const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyCX9myU2sx-LCyGAUsKuVEOJJXo7jhurdg",
  authDomain: "secret-x-c3045.firebaseapp.com",
  projectId: "secret-x-c3045",
  storageBucket: "secret-x-c3045.firebasestorage.app",
  messagingSenderId: "116252360970",
  appId: "1:116252360970:web:98622eb77bf5646c89baf3"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Persistence ko optional bana diya (warning hatane ke liye)
try {
  db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.log('ℹ️ Multiple tabs open - persistence memory cache use kar raha hai');
      } else if (err.code === 'unimplemented') {
        console.log('ℹ️ Browser persistence support nahi karta');
      }
    });
} catch (e) {
  console.log('ℹ️ Persistence enable nahi hua, koi baat nahi');
}

console.log('🔥 Firebase Secret-x ke liye successfully initialize ho gaya!');
