"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { mergePointsFromPhone, checkPhonePointsForMerge } from './pointMergeActions';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export interface CustomerData {
    phone?: string;
    fullName?: string;
    email?: string;
    points?: number;
    userId?: string;
    [key: string]: any;
}

const normalizePhone = (phone?: string) => {
    if (typeof phone !== 'string') return undefined;
    const trimmed = phone.trim();
    return trimmed || undefined;
};

const normalizeText = (value?: string) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
};

const toNumberSafe = (value: any) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Find or create customer with automatic points merging when LINE ID is connected
 */
export async function findOrCreateCustomer(customerData: CustomerData, userId?: string) {
    const lineUserId = normalizeText(userId);
    const normalizedPhone = normalizePhone(customerData?.phone);
    if (!normalizedPhone && !lineUserId) {
        return {
            success: false,
            error: 'Phone number or User ID is required.'
        };
    }

    const customersRef = db.collection('customers');
    let lineCustomerDoc: any = null;
    if (lineUserId) {
        lineCustomerDoc = await customersRef.doc(lineUserId).get();
    }
    let phoneCustomerDoc: any = null;
    if (normalizedPhone) {
        const phoneSnapshot = await customersRef.where('phone', '==', normalizedPhone).limit(3).get();
        if (!phoneSnapshot.empty) {
            phoneCustomerDoc = lineUserId
                ? (phoneSnapshot.docs.find((doc: any) => doc.id === lineUserId) || phoneSnapshot.docs[0])
                : phoneSnapshot.docs[0];
        }
    }

    try {
        const targetRef = lineUserId
            ? customersRef.doc(lineUserId)
            : (phoneCustomerDoc?.ref || customersRef.doc());

        const targetDoc = lineUserId ? lineCustomerDoc : phoneCustomerDoc;
        const targetExists = !!targetDoc?.exists;
        const targetData = targetExists ? (targetDoc.data() || {}) : {};

        let legacyPhoneDocToDelete: any = null;
        let transferredPointsFromLegacy = 0;
        let legacyPhoneData: any = {};

        if (lineUserId && phoneCustomerDoc && phoneCustomerDoc.id !== lineUserId) {
            const phoneData = phoneCustomerDoc.data() || {};
            const phoneLinkedUserId = normalizeText(phoneData.userId);
            if (!phoneLinkedUserId || phoneLinkedUserId === lineUserId) {
                legacyPhoneDocToDelete = phoneCustomerDoc.ref;
                legacyPhoneData = phoneData;
                transferredPointsFromLegacy = toNumberSafe(phoneData.points);
            } else {
                console.warn(`Phone ${normalizedPhone} is already linked to another LINE user (${phoneLinkedUserId}).`);
            }
        }

        const sourceData = {
            ...legacyPhoneData,
            ...targetData,
        };

        const finalFullName = normalizeText(customerData.fullName) || normalizeText(sourceData.fullName);
        const finalEmail = normalizeText(customerData.email) || normalizeText(sourceData.email) || '';
        const finalPhone = normalizedPhone || normalizePhone(sourceData.phone);
        const finalPictureUrl = normalizeText(customerData.pictureUrl) || normalizeText(sourceData.pictureUrl) || '';

        const upsertData: any = {
            updatedAt: FieldValue.serverTimestamp(),
            userId: lineUserId || sourceData.userId || null,
            lineUserId: lineUserId || sourceData.lineUserId || null,
        };

        if (finalFullName) upsertData.fullName = finalFullName;
        if (finalPhone) upsertData.phone = finalPhone;
        upsertData.email = finalEmail;
        if (finalPictureUrl) upsertData.pictureUrl = finalPictureUrl;
        if (customerData.note) upsertData.note = customerData.note;

        if (lineUserId && !sourceData.connectedLineAt) {
            upsertData.connectedLineAt = FieldValue.serverTimestamp();
        }

        if (targetExists) {
            if (transferredPointsFromLegacy > 0) {
                upsertData.points = FieldValue.increment(transferredPointsFromLegacy);
            }
            await targetRef.update(upsertData);
        } else {
            upsertData.createdAt = FieldValue.serverTimestamp();
            upsertData.points = toNumberSafe(sourceData.points);
            await targetRef.set(upsertData, { merge: true });
        }

        if (legacyPhoneDocToDelete) {
            await legacyPhoneDocToDelete.delete();
        }

        let mergedPoints = 0;
        if (lineUserId && finalPhone) {
            const phonePointsCheck = await checkPhonePointsForMerge(finalPhone);
            if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
                const mergeResult = await mergePointsFromPhone(lineUserId, finalPhone);
                if (mergeResult.success) {
                    mergedPoints = mergeResult.mergedPoints || 0;
                }
            }
        }

        return {
            success: true,
            customerId: targetRef.id,
            mergedPoints,
            transferredPoints: transferredPointsFromLegacy
        };

    } catch (error: any) {
        console.error("Error in findOrCreateCustomer:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Connect LINE ID to existing customer by phone number
 */
export async function connectLineToCustomer(phoneNumber: string, userId: string, additionalData: any = {}, auth?: AuthContext) {
    const adminAuth = await requireAdminAuth(auth);
    if (!adminAuth.ok) {
        return { success: false, error: adminAuth.error };
    }
    return connectLineToCustomerInternal(phoneNumber, userId, additionalData);
}

export async function connectLineToCustomerInternal(phoneNumber: string, userId: string, additionalData: any = {}) {
    if (!phoneNumber || !userId) {
        return {
            success: false,
            error: 'เบอร์โทรศัพท์และ LINE User ID จำเป็นต้องระบุ'
        };
    }

    try {
        const existingLineCustomer = await db.collection('customers').doc(userId).get();
        if (existingLineCustomer.exists) {
            return {
                success: false,
                error: 'LINE ID นี้ถูกใช้งานแล้ว'
            };
        }

        const phoneQuery = db.collection('customers').where('phone', '==', phoneNumber).limit(1);
        const phoneSnapshot = await phoneQuery.get();

        let customerId;
        let mergedPoints = 0;

        if (!phoneSnapshot.empty) {
            const existingCustomer = phoneSnapshot.docs[0];
            const existingData = existingCustomer.data();

            if (existingData.userId) {
                return {
                    success: false,
                    error: 'ลูกค้ารายนี้มี LINE ID เชื่อมต่ออยู่แล้ว'
                };
            }

            const newCustomerRef = db.collection('customers').doc(userId);
            const newCustomerData = {
                ...existingData,
                ...additionalData,
                userId: userId,
                lineUserId: userId,
                phone: phoneNumber,
                phoneNumber: phoneNumber,
                connectedLineAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await newCustomerRef.set(newCustomerData);
            await existingCustomer.ref.delete();

            customerId = userId;

        } else {
            customerId = userId;
        }

        const phonePointsCheck = await checkPhonePointsForMerge(phoneNumber);

        if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
            const mergeResult = await mergePointsFromPhone(userId, phoneNumber);

            if (mergeResult.success) {
                mergedPoints = mergeResult.mergedPoints || 0;
                await db.collection('customers').doc(userId).update({
                    userId: userId,
                    lineUserId: userId,
                    mergedFromPhone: true,
                    mergedPoints: mergedPoints,
                    mergedAt: FieldValue.serverTimestamp(),
                });
            }
        }

        if (phoneSnapshot.empty) {
            const newCustomerData = {
                fullName: additionalData.fullName || '',
                phone: phoneNumber,
                phoneNumber: phoneNumber,
                email: additionalData.email || '',
                userId: userId,
                lineUserId: userId,
                points: mergedPoints,
                mergedFromPhone: mergedPoints > 0,
                mergedPoints: mergedPoints > 0 ? mergedPoints : null,
                mergedAt: mergedPoints > 0 ? FieldValue.serverTimestamp() : null,
                connectedLineAt: FieldValue.serverTimestamp(),
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await db.collection('customers').doc(userId).set(newCustomerData);
        }

        return {
            success: true,
            customerId: userId,
            mergedPoints: mergedPoints,
            message: mergedPoints > 0
                ? `เชื่อมต่อ LINE สำเร็จ และรวมคะแนน ${mergedPoints} คะแนนจากระบบเบอร์โทร`
                : 'เชื่อมต่อ LINE สำเร็จ'
        };

    } catch (error: any) {
        console.error("Error connecting LINE to customer:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

export async function addCustomer(customerData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('customers').add({
            ...customerData,
            lineUserId: customerData.userId || customerData.lineUserId || null,
            points: Number(customerData.points) || 0,
            createdAt: FieldValue.serverTimestamp(),
        });
        revalidatePath('/admin/customers');
        return { success: true, message: 'เพิ่มลูกค้าสำเร็จ!' };
    } catch (error: any) {
        console.error("Error adding customer:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteCustomer(customerId: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('customers').doc(customerId).delete();
        revalidatePath('/admin/customers');
        return { success: true, message: 'ลบลูกค้าสำเร็จ!' };
    } catch (error: any) {
        console.error("Error deleting customer:", error);
        return { success: false, error: error.message };
    }
}
