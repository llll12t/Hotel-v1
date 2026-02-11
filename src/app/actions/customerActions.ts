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

/**
 * Find or create customer with automatic points merging when LINE ID is connected
 */
export async function findOrCreateCustomer(customerData: CustomerData, userId?: string) {
    if (!customerData?.phone && !userId) {
        return {
            success: false,
            error: 'Phone number or User ID is required.'
        };
    }

    const customersRef = db.collection('customers');
    let customerQuery;
    let customerDocRef;

    // Prioritize finding customer by LINE User ID if available
    if (userId) {
        customerDocRef = customersRef.doc(userId);
        const customerDoc = await customerDocRef.get();
        customerQuery = customerDoc.exists ? [customerDoc] : [];
    } else {
        const q = customersRef.where('phone', '==', customerData.phone).limit(1);
        const snapshot = await q.get();
        customerQuery = snapshot.docs;
        if (customerQuery.length > 0) {
            customerDocRef = customerQuery[0].ref;
        }
    }

    try {
        let customerId;
        let mergedPoints = 0;

        if (customerQuery.length > 0) {
            // --- Customer Found ---
            const customerDoc = customerQuery[0];
            customerId = customerDoc.id;

            const updateData: any = {
                updatedAt: FieldValue.serverTimestamp(),
            };

            if (customerData.fullName) updateData.fullName = customerData.fullName;
            if (customerData.email) updateData.email = customerData.email;
            if (customerData.phone) updateData.phone = customerData.phone;

            if (userId && customerData.phone && !customerDoc.data().userId) {
                const phonePointsCheck = await checkPhonePointsForMerge(customerData.phone);

                if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
                    const mergeResult = await mergePointsFromPhone(userId, customerData.phone);

                    if (mergeResult.success) {
                        mergedPoints = mergeResult.mergedPoints || 0;
                        updateData.mergedFromPhone = true;
                        updateData.mergedPoints = mergedPoints;
                        updateData.mergedAt = FieldValue.serverTimestamp();
                    }
                }
                updateData.userId = userId;
            }

            if (customerDocRef) {
                await customerDocRef.update(updateData);
            } else {
                // Should not happen if logic correct
            }
            console.log(`Updated customer ${customerId}`);

        } else {
            // --- Customer Not Found - Create New ---
            if (userId && customerData.phone) {
                const phonePointsCheck = await checkPhonePointsForMerge(customerData.phone);

                if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
                    const mergeResult = await mergePointsFromPhone(userId, customerData.phone);
                    if (mergeResult.success) {
                        mergedPoints = mergeResult.mergedPoints || 0;
                    }
                }
            }

            const newCustomerRef = userId ? customersRef.doc(userId) : customersRef.doc();
            const newCustomerData = {
                fullName: customerData.fullName,
                phone: customerData.phone,
                email: customerData.email || '',
                userId: userId || null,
                points: mergedPoints,
                mergedFromPhone: mergedPoints > 0,
                mergedPoints: mergedPoints > 0 ? mergedPoints : null,
                mergedAt: mergedPoints > 0 ? FieldValue.serverTimestamp() : null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await newCustomerRef.set(newCustomerData);
            customerId = newCustomerRef.id;
        }

        return {
            success: true,
            customerId: customerId,
            mergedPoints: mergedPoints
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
                    mergedFromPhone: true,
                    mergedPoints: mergedPoints,
                    mergedAt: FieldValue.serverTimestamp(),
                    points: FieldValue.increment(mergedPoints)
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
