// ============================================
// 🔐 AUTHENTICATION MODULE
// ============================================

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

// Current User State
let currentUser = null;
let currentUserData = null;

// ---- Toggle Forms ----
document.getElementById('show-register').addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.remove('active');
  registerForm.classList.add('active');
  loginError.textContent = '';
});

document.getElementById('show-login').addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.remove('active');
  loginForm.classList.add('active');
  registerError.textContent = '';
});

// ---- Login ----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    console.log('✅ Login successful:', cred.user.uid);
  } catch (err) {
    console.error('Login error:', err);
    loginError.textContent = getErrorMessage(err.code);
  }
});

// ---- Register ----
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.textContent = '';

  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (username.length < 2) {
    registerError.textContent = 'Username kam se kam 2 characters ka hona chahiye';
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);

    // Save user profile to Firestore
    await db.collection('users').doc(cred.user.uid).set({
      username: username,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      online: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Registration successful:', cred.user.uid);
  } catch (err) {
    console.error('Register error:', err);
    registerError.textContent = getErrorMessage(err.code);
  }
});

// ---- Logout ----
document.getElementById('btn-logout').addEventListener('click', async () => {
  try {
    // Mark offline
    if (currentUser) {
      await db.collection('users').doc(currentUser.uid).update({
        online: false,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await auth.signOut();
    console.log('🚪 Logged out');
  } catch (err) {
    console.error('Logout error:', err);
  }
});

// ---- Auth State Listener ----
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;

    // Fetch user data
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      currentUserData = doc.data();
    } else {
      // Fallback if doc doesn't exist
      currentUserData = {
        username: user.email.split('@')[0],
        email: user.email
      };
      await db.collection('users').doc(user.uid).set(currentUserData, { merge: true });
    }

    // Mark online
    await db.collection('users').doc(user.uid).update({
      online: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update UI
    document.getElementById('my-username').textContent = currentUserData.username;
    document.getElementById('my-avatar').textContent = currentUserData.username.charAt(0).toUpperCase();

    // Switch screens
    authScreen.classList.remove('active');
    appScreen.classList.add('active');

    // Load chats & groups
    loadChats();
    loadGroups();

  } else {
    currentUser = null;
    currentUserData = null;
    authScreen.classList.add('active');
    appScreen.classList.remove('active');
  }
});

// ---- Error Messages ----
function getErrorMessage(code) {
  const messages = {
    'auth/user-not-found': 'Yeh email registered nahi hai',
    'auth/wrong-password': 'Password galat hai',
    'auth/email-already-in-use': 'Yeh email pehle se registered hai',
    'auth/invalid-email': 'Email format galat hai',
    'auth/weak-password': 'Password kam se kam 6 characters ka hona chahiye',
    'auth/too-many-requests': 'Bahut zyada attempts. Thodi der baad try karo',
    'auth/network-request-failed': 'Internet connection check karo'
  };
  return messages[code] || 'Kuch galat ho gaya. Dobara try karo.';
}

// ---- Window close → mark offline ----
window.addEventListener('beforeunload', () => {
  if (currentUser) {
    // Use navigator.sendBeacon for reliability
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${currentUser.uid}?updateMask.fieldPaths=online`;
    // Simple approach - may not always fire
    navigator.sendBeacon(url);
  }
});
