"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Adds a new room type to Firestore.
 */
export async function addRoomType(roomTypeData: any) {
    try {
        const roomTypeRef = await db.collection('roomTypes').add({
            ...roomTypeData,
            status: 'available',
            createdAt: FieldValue.serverTimestamp(),
        });

        revalidatePath('/room-types');

        return { success: true, message: `เพิ่มประเภทห้องพักสำเร็จ ID: ${roomTypeRef.id}` };

    } catch (error: any) {
        console.error("🔥 Error adding room type to Firestore:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches available room types for customer display.
 */
export async function getRoomTypesForCustomer() {
    try {
        const roomTypesRef = db.collection('roomTypes');
        // Try ordering by name first (requires index)
        try {
            const q = roomTypesRef.where('status', '==', 'available').orderBy('name');
            const snapshot = await q.get();
            const roomTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { success: true, roomTypes: JSON.parse(JSON.stringify(roomTypes)) };
        } catch (idxError: any) {
            // Fallback if index missing or permission issue on specific query
            // Just get available and sort manually
            const snapshot = await roomTypesRef.where('status', '==', 'available').get();
            const roomTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            roomTypes.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
            return { success: true, roomTypes: JSON.parse(JSON.stringify(roomTypes)) };
        }
    } catch (error: any) {
        console.error("Error fetching customer room types:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all room types for admin.
 */
export async function getAllRoomTypes() {
    try {
        const snapshot = await db.collection('roomTypes').orderBy('createdAt', 'desc').get();
        const roomTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, roomTypes: JSON.parse(JSON.stringify(roomTypes)) };
    } catch (error: any) {
        console.error("Error fetching all room types:", error);
        return { success: false, error: error.message };
    }
}
