"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export async function markAllNotificationsAsRead(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const notificationsRef = db.collection('notifications');
        const q = notificationsRef.where("isRead", "==", false);

        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            return { success: true, message: "No unread notifications." };
        }

        const batch = db.batch();
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, { isRead: true });
        });

        await batch.commit();

        console.log(`Marked ${querySnapshot.size} notifications as read.`);
        return { success: true };

    } catch (error: any) {
        console.error("Error marking notifications as read:", error);
        return { success: false, error: error.message };
    }
}


export async function clearAllNotifications(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const notificationsRef = db.collection('notifications');
        const querySnapshot = await notificationsRef.get();

        if (querySnapshot.empty) {
            return { success: true, message: "No notifications to clear." };
        }

        const batch = db.batch();
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        console.log(`Cleared ${querySnapshot.size} notifications.`);
        return { success: true };

    } catch (error: any) {
        console.error("Error clearing notifications:", error);
        return { success: false, error: error.message };
    }
}
