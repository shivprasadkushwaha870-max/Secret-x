// ============================================
// 🔐 AUTHENTICATION MODULE (FIXED)
// ============================================

let currentUser = null;
let currentUserData = null;

console.log('🔐 Auth module loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded');
  initializeAuth();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initializeAuth();
}

function initializeAuth() {
  console.log('🔄 Initializing auth...');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');

  // Toggle Forms
  const showRegisterBtn = document.getElementById('show-register');
  const showLoginBtn = document.getElementById('show-login');

  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
      if (loginError) loginError.textContent = '';
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
      if (registerError) registerError.textContent = '';
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
    console.log('✅ Login listener attached');
  }

  // Register
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
    console.log('✅ Register listener attached');
  }

  // Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Auth State
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(handleAuthStateChange);
    console.log('✅ Auth state listener attached');
  } else {
    console.error('❌ Firebase auth not defined!');
  }
}

// ---- LOGIN ----
async function handleLogin(e) {
  e.preventDefault();
  const loginError = document.getElementById('login-error');
  if (loginError) loginError.textContent = '';

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    if (loginError) loginError.textContent = 'Email aur password dono bharo!';
    return;
  }

  try {
    console.log('🔄 Signing in...');
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    console.error('❌ Login error:', err);
    if (loginError) loginError.textContent = getErrorMessage(err.code);
  }
}

// ---- REGISTER ----
async function handleRegister(e) {
  e.preventDefault();
  const registerError = document.getElementById('register-error');
  if (registerError) registerError.textContent = '';

  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (username.length < 2) {
    registerError.textContent = 'Username kam se kam 2 characters ka ho';
    return;
  }
  if (password.length < 6) {
    registerError.textContent = 'Password kam se kam 6 characters ka ho';
    return;
  }

  try {
    console.log('🔄 Creating account...');
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
    console.error('❌ Register error:', err);
    if (registerError) registerError.textContent = getErrorMessage(err.code);
  }
}

// ---- LOGOUT ----
async function handleLogout() {
  try {
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
}

// ---- AUTH STATE CHANGE (FIXED) ----
async function handleAuthStateChange(user) {
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');

  if (user) {
    console.log('✅ User logged in:', user.uid);
    currentUser = user;

    try {
      const doc = await db.collection('users').doc(user.uid).get();

      if (doc.exists && doc.data().username) {
        // User data exists with username
        currentUserData = doc.data();
      } else {
        // Username missing - create/update document
        const fallbackUsername = user.email ? user.email.split('@')[0] : 'User';
        currentUserData = {
          username: fallbackUsername,
          email: user.email || ''
        };

        console.log('⚠️ Username missing, creating document...');
        await db.collection('users').doc(user.uid).set({
          username: fallbackUsername,
          email: user.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          online: true,
          lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      // Update UI safely
      const myUsernameEl = document.getElementById('my-username');
      const myAvatarEl = document.getElementById('my-avatar');

      if (myUsernameEl) myUsernameEl.textContent = currentUserData.username;
      if (myAvatarEl) {
        const firstChar = (currentUserData.username || 'U').charAt(0).toUpperCase();
        myAvatarEl.textContent = firstChar;
      }

      // Switch screens
      if (authScreen) authScreen.classList.remove('active');
      if (appScreen) appScreen.classList.add('active');

      // Load chats & groups
      if (typeof loadChats === 'function') loadChats();
      if (typeof loadGroups === 'function') loadGroups();

    } catch (err) {
      console.error('❌ Error loading user data:', err);
    }

  } else {
    console.log('👋 User logged out');
    currentUser = null;
    currentUserData = null;

    if (authScreen) authScreen.classList.add('active');
    if (appScreen) appScreen.classList.remove('active');
  }
}

// ---- ERROR MESSAGES ----
function getErrorMessage(code) {
  const messages = {
    'auth/user-not-found': 'Yeh email registered nahi hai. Pehle Register karo!',
    'auth/wrong-password': 'Password galat hai!',
    'auth/email-already-in-use': 'Yeh email pehle se registered hai',
    'auth/invalid-email': 'Email format galat hai',
    'auth/weak-password': 'Password kam se kam 6 characters ka hona chahiye',
    'auth/too-many-requests': 'Bahut zyada attempts. Thodi der baad try karo',
    'auth/network-request-failed': 'Internet connection check karo',
    'auth/invalid-credential': 'Email ya password galat hai'
  };
  return messages[code] || 'Kuch galat ho gaya. Dobara try karo.';
}
