'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

// --- Types ---
export interface ShopProfile {
    storeName: string;
    currency: string;
    currencySymbol: string;
    [key: string]: any;
}

export interface NotificationSettings {
    customerNotifications?: {
        newBooking?: boolean;
        appointmentConfirmed?: boolean;
        serviceCompleted?: boolean;
        reviewRequest?: boolean;
        appointmentCancelled?: boolean;
        paymentInvoice?: boolean;
        appointmentReminder?: boolean;
        [key: string]: boolean | undefined;
    };
    adminNotifications?: {
        newBooking?: boolean;
        paymentReceived?: boolean;
        customerConfirmed?: boolean;
        telegram?: { enabled: boolean };
        [key: string]: any;
    };
    [key: string]: any;
}

// --- Function to get shop profile settings with cache ---
let shopProfileCache: ShopProfile | null = null;
let cacheTimestamp: number | null = null;

export async function getShopProfile(): Promise<{ success: boolean; profile?: ShopProfile; error?: string }> {
    const now = Date.now();
    // Cache for 1 minute
    if (shopProfileCache && cacheTimestamp && (now - cacheTimestamp < 60000)) {
        return { success: true, profile: shopProfileCache };
    }

    if (!db) {
        return { success: false, error: "Firebase Admin is not initialized." };
    }
    try {
        const docRef = db.collection('settings').doc('profile');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const profileData = docSnap.data() as ShopProfile;
            shopProfileCache = profileData;
            cacheTimestamp = now;
            return { success: true, profile: profileData };
        } else {
            const defaultProfile: ShopProfile = {
                storeName: 'ชื่อร้านค้า',
                currency: '฿',
                currencySymbol: 'บาท',
            };
            return { success: true, profile: defaultProfile };
        }
    } catch (error: any) {
        console.error("Error getting shop profile:", error);
        return { success: false, error: error.message };
    }
}

export async function saveProfileSettings(settingsData: any, auth?: AuthContext) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const settingsRef = db.collection('settings').doc('profile');
        await settingsRef.set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        shopProfileCache = null; // Invalidate cache
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function saveNotificationSettings(settingsData: NotificationSettings, auth?: AuthContext) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const settingsRef = db.collection('settings').doc('notifications');
        // Ensure newBooking toggle exists
        const updatedSettings = {
            ...settingsData,
            customerNotifications: {
                ...settingsData.customerNotifications,
                newBooking: typeof settingsData?.customerNotifications?.newBooking === 'boolean'
                    ? settingsData.customerNotifications.newBooking
                    : true,
            },
            updatedAt: FieldValue.serverTimestamp(),
        };
        await settingsRef.set(updatedSettings, { merge: true });
        notificationSettingsCache = null;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Function to get notification settings with cache ---
let notificationSettingsCache: NotificationSettings | null = null;
let notificationCacheTimestamp: number | null = null;

const makeSerializable = (data: any): any => {
    if (!data) return {};
    return JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
            return new Date(value._seconds * 1000 + value._nanoseconds / 1000000).toISOString();
        }
        return value;
    }));
};

export async function getNotificationSettings(): Promise<{ success: boolean; settings?: NotificationSettings; error?: string }> {
    const now = Date.now();
    // Cache for 1 minute
    if (notificationSettingsCache && notificationCacheTimestamp && (now - notificationCacheTimestamp < 60000)) {
        return { success: true, settings: notificationSettingsCache };
    }

    if (!db) {
        return { success: false, error: "Firebase Admin is not initialized." };
    }
    try {
        const docRef = db.collection('settings').doc('notifications');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const settingsData = docSnap.data();
            const serializableSettings = makeSerializable(settingsData);

            notificationSettingsCache = serializableSettings;
            notificationCacheTimestamp = now;

            return { success: true, settings: serializableSettings };
        } else {
            return { success: true, settings: {} };
        }
    } catch (error: any) {
        console.error("Error getting notification settings:", error);
        return { success: false, error: error.message };
    }
}

// Reuse generic save for others if schema is flexible, or make specific
export async function saveBookingSettings(settingsData: any, auth?: AuthContext) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('settings').doc('booking').set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function savePointSettings(settingsData: any, auth?: AuthContext) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('settings').doc('points').set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function savePaymentSettings(settingsData: any, auth?: AuthContext) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('settings').doc('payment').set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function saveCalendarSettings(settingsData: any, auth?: AuthContext) {
    if (!db) return { success: false, error: "Firebase Admin is not initialized." };
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('settings').doc('calendar').set({
            ...settingsData,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getPaymentSettings(auth?: AuthContext) {
    if (!db) return { success: false, error: "บริการ Firebase ไม่พร้อมใช้งาน" };

    try {
        const lineAuth = await requireLineAuth(auth);
        if (!lineAuth.ok) return { success: false, error: lineAuth.error };

        const docRef = db.collection('settings').doc('payment');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const settingsData = docSnap.data();
            return { success: true, settings: makeSerializable(settingsData) };
        } else {
            return { success: false, error: "ยังไม่ได้ตั้งค่าการชำระเงิน" };
        }
    } catch (error: any) {
        console.error("Error getting payment settings:", error);
        return { success: false, error: error.message };
    }
}
