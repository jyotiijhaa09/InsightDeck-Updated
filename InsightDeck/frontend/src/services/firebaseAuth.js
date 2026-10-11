/**
 * Firebase Authentication Service for InsightDeck.
 * Supports official Firebase Authentication REST API using environment variables:
 * - VITE_FIREBASE_API_KEY
 * - VITE_FIREBASE_AUTH_DOMAIN
 * - VITE_FIREBASE_PROJECT_ID
 * - VITE_FIREBASE_STORAGE_BUCKET
 * - VITE_FIREBASE_MESSAGING_SENDER_ID
 * - VITE_FIREBASE_APP_ID
 * 
 * Provides robust fallback when keys are not yet configured so login/signup works out of the box.
 */

const STORAGE_USER_KEY = 'insightdeck_auth_user';
const STORAGE_TOKEN_KEY = 'insightdeck_auth_token';

// Read Firebase config from environment variables
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const listeners = new Set();

function notifyListeners(user) {
  listeners.forEach((cb) => {
    try {
      cb(user);
    } catch (e) {
      console.error('Auth state listener error:', e);
    }
  });
}

/**
 * Gets currently logged in user from localStorage.
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Gets the current Firebase ID token.
 */
export function getIdToken() {
  return localStorage.getItem(STORAGE_TOKEN_KEY) || '';
}

/**
 * Signs up a new user with Name, Email, and Password.
 */
export async function signUp(name, email, password) {
  const cleanEmail = email.trim().toLowerCase();

  // If real Firebase API key is provided, use Firebase Identity Toolkit
  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        returnSecureToken: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || 'Signup failed';
      throw new Error(formatFirebaseError(msg));
    }

    const user = {
      uid: data.localId,
      email: data.email,
      displayName: name || cleanEmail.split('@')[0],
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_TOKEN_KEY, data.idToken);
    notifyListeners(user);
    return user;
  }

  // Graceful local Firebase-compatible Auth for immediate testing & offline mode
  const usersStore = getLocalRegisteredUsers();
  if (usersStore[cleanEmail]) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  const uid = 'usr_' + Math.random().toString(36).substring(2, 10);
  const token = `mock-token-${uid}`;
  const user = {
    uid,
    email: cleanEmail,
    displayName: name || cleanEmail.split('@')[0],
    passwordHash: btoa(password),
    createdAt: new Date().toISOString(),
  };

  usersStore[cleanEmail] = user;
  saveLocalRegisteredUsers(usersStore);

  const sessionUser = { uid: user.uid, email: user.email, displayName: user.displayName };
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(sessionUser));
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  notifyListeners(sessionUser);
  return sessionUser;
}

/**
 * Signs in an existing user with Email and Password.
 */
export async function signIn(email, password) {
  const cleanEmail = email.trim().toLowerCase();

  // If real Firebase API key is configured
  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        returnSecureToken: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || 'Login failed';
      throw new Error(formatFirebaseError(msg));
    }

    const user = {
      uid: data.localId,
      email: data.email,
      displayName: data.displayName || cleanEmail.split('@')[0],
    };

    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_TOKEN_KEY, data.idToken);
    notifyListeners(user);
    return user;
  }

  // Local Firebase-compatible fallback check
  const usersStore = getLocalRegisteredUsers();
  const existing = usersStore[cleanEmail];

  // Default demo account
  if (cleanEmail === 'admin@insightdeck.io' && password === 'Demo123!') {
    const adminUser = { uid: 'usr_admin', email: cleanEmail, displayName: 'Executive Auditor' };
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(adminUser));
    localStorage.setItem(STORAGE_TOKEN_KEY, 'mock-token-usr_admin');
    notifyListeners(adminUser);
    return adminUser;
  }

  if (!existing || existing.passwordHash !== btoa(password)) {
    throw new Error('Invalid email or password. Please check your credentials.');
  }

  const sessionUser = { uid: existing.uid, email: existing.email, displayName: existing.displayName };
  const token = `mock-token-${existing.uid}`;
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(sessionUser));
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  notifyListeners(sessionUser);
  return sessionUser;
}

/**
 * Signs out the current user.
 */
export function signOut() {
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  notifyListeners(null);
}

/**
 * Subscribes to auth state changes.
 */
export function onAuthStateChanged(callback) {
  listeners.add(callback);
  callback(getCurrentUser());
  return () => listeners.delete(callback);
}

// Helpers
function getLocalRegisteredUsers() {
  try {
    const raw = localStorage.getItem('insightdeck_registered_users');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalRegisteredUsers(users) {
  try {
    localStorage.setItem('insightdeck_registered_users', JSON.stringify(users));
  } catch {
    // ignore
  }
}

function formatFirebaseError(msg) {
  if (msg.includes('EMAIL_EXISTS')) return 'An account with this email address already exists.';
  if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('EMAIL_NOT_FOUND') || msg.includes('INVALID_PASSWORD')) {
    return 'Invalid email or password. Please try again.';
  }
  if (msg.includes('USER_DISABLED')) return 'This user account has been disabled.';
  if (msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) return 'Too many attempts. Please try again later.';
  if (msg.includes('WEAK_PASSWORD')) return 'Password should be at least 6 characters.';
  return msg.replace(/_/g, ' ').toLowerCase();
}
