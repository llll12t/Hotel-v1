import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, Auth, browserLocalPersistence, setPersistence } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

try {
    if (getApps().length > 0) {
        app = getApp(); // Use the default app
    } else {
        app = initializeApp(firebaseConfig);
    }

    // Initialize Firestore with settings if not already
    // Use try-catch or just getFirestore as settings might already be applied if app reused
    db = getFirestore(app);

    auth = getAuth(app);

    // Ensure persistence
    setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.warn("Auth persistence warning:", error);
    });

} catch (e) {
    console.error("Firebase Client Init Error:", e);
    throw e;
}

export { db, auth };
