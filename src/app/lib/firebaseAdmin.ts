import admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import { Auth } from 'firebase-admin/auth';

let db: Firestore;
let auth: Auth;

if (!admin.apps.length) {
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !projectId) {
            throw new Error("Missing required Firebase environment variables.");
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });

        db = admin.firestore();
        auth = admin.auth();
        console.log('✅ Firebase Admin SDK initialized successfully.');

    } catch (error) {
        console.error('❌ Firebase Admin Initialization Error:', error);
        throw error; // Rethrow to fail fast in server actions
    }
} else {
    db = admin.firestore();
    auth = admin.auth();
}

export { db, auth };
