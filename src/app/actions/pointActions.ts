"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export interface PointSettings {
    enablePurchasePoints: boolean;
    pointsPerCurrency: number;
    enableVisitPoints: boolean;
    pointsPerVisit: number;
    enableReviewPoints: boolean;
    reviewPoints: number;
}

/**
 * Award points to customer based on purchase amount
 */
export async function awardPointsForPurchase(userId: string, purchaseAmount: number) {
    if (!userId) {
        return { success: false, error: 'No userId provided - customer may not have LINE ID' };
    }

    if (!purchaseAmount || purchaseAmount <= 0) {
        return { success: false, error: 'Invalid purchase amount' };
    }

    try {
        const pointSettingsRef = db.collection('settings').doc('points');
        const pointSettingsDoc = await pointSettingsRef.get();

        let pointsToAward = 0;
        if (pointSettingsDoc.exists) {
            const pointSettings = pointSettingsDoc.data() as PointSettings;

            if (pointSettings.enablePurchasePoints) {
                const pointsPerCurrency = pointSettings.pointsPerCurrency || 100;
                pointsToAward = Math.floor(purchaseAmount / pointsPerCurrency);
            }
        }

        if (pointsToAward <= 0) {
            return { success: true, pointsAwarded: 0 };
        }

        const customerRef = db.collection('customers').doc(userId);
        await db.runTransaction(async (transaction: any) => {
            const customerDoc = await transaction.get(customerRef);

            if (customerDoc.exists) {
                const currentPoints = customerDoc.data().points || 0;
                transaction.update(customerRef, {
                    points: currentPoints + pointsToAward,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } else {
                transaction.set(customerRef, {
                    points: pointsToAward,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }
        });

        return { success: true, pointsAwarded: pointsToAward };
    } catch (error: any) {
        console.error("Error awarding points for purchase:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Award points to customer for visit
 */
export async function awardPointsForVisit(userId: string) {
    if (!userId) {
        return { success: false, error: 'No userId provided - customer may not have LINE ID' };
    }

    try {
        const pointSettingsRef = db.collection('settings').doc('points');
        const pointSettingsDoc = await pointSettingsRef.get();

        let pointsToAward = 0;
        if (pointSettingsDoc.exists) {
            const pointSettings = pointSettingsDoc.data() as PointSettings;

            if (pointSettings.enableVisitPoints) {
                pointsToAward = pointSettings.pointsPerVisit || 1;
            }
        }

        if (pointsToAward <= 0) {
            return { success: true, pointsAwarded: 0 };
        }

        const customerRef = db.collection('customers').doc(userId);
        await db.runTransaction(async (transaction: any) => {
            const customerDoc = await transaction.get(customerRef);

            if (customerDoc.exists) {
                const currentPoints = customerDoc.data().points || 0;
                transaction.update(customerRef, {
                    points: currentPoints + pointsToAward,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } else {
                transaction.set(customerRef, {
                    points: pointsToAward,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }
        });

        return { success: true, pointsAwarded: pointsToAward };
    } catch (error: any) {
        console.error("Error awarding points for visit:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current point settings
 */
export async function getPointSettings() {
    try {
        const pointSettingsRef = db.collection('settings').doc('points');
        const pointSettingsDoc = await pointSettingsRef.get();

        if (pointSettingsDoc.exists) {
            return { success: true, settings: pointSettingsDoc.data() };
        }

        return {
            success: true,
            settings: {
                reviewPoints: 5,
                pointsPerCurrency: 100,
                pointsPerVisit: 1,
                enableReviewPoints: true,
                enablePurchasePoints: false,
                enableVisitPoints: false
            } as PointSettings
        };
    } catch (error: any) {
        console.error("Error getting point settings:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Award points to customer by phone number (for customers without LINE ID)
 */
export async function awardPointsByPhone(phoneNumber: string, purchaseAmount: number, appointmentId: string) {
    if (!phoneNumber) {
        return { success: false, error: 'Phone number is required' };
    }

    if (!purchaseAmount || purchaseAmount <= 0) {
        return { success: false, error: 'Invalid purchase amount' };
    }

    try {
        const pointSettingsRef = db.collection('settings').doc('points');
        const pointSettingsDoc = await pointSettingsRef.get();

        let pointsToAward = 0;
        if (pointSettingsDoc.exists) {
            const pointSettings = pointSettingsDoc.data() as PointSettings;

            if (pointSettings.enablePurchasePoints) {
                const pointsPerCurrency = pointSettings.pointsPerCurrency || 100;
                pointsToAward = Math.floor(purchaseAmount / pointsPerCurrency);
            }

            if (pointSettings.enableVisitPoints) {
                const visitPoints = pointSettings.pointsPerVisit || 1;
                pointsToAward += visitPoints;
            }
        }

        if (pointsToAward <= 0) {
            return { success: true, pointsAwarded: 0 };
        }

        const customerRef = db.collection('customers_by_phone').doc(phoneNumber);

        await db.runTransaction(async (transaction: any) => {
            const customerDoc = await transaction.get(customerRef);

            if (customerDoc.exists) {
                const currentPoints = customerDoc.data().points || 0;
                transaction.update(customerRef, {
                    points: currentPoints + pointsToAward,
                    lastAppointmentId: appointmentId,
                    lastPointsAwarded: pointsToAward,
                    lastPointsDate: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } else {
                transaction.set(customerRef, {
                    phoneNumber: phoneNumber,
                    points: pointsToAward,
                    lastAppointmentId: appointmentId,
                    lastPointsAwarded: pointsToAward,
                    lastPointsDate: FieldValue.serverTimestamp(),
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    hasLineId: false,
                    notificationNote: 'Customer without LINE ID - consider manual contact for point notifications'
                });
            }
        });

        return {
            success: true,
            pointsAwarded: pointsToAward,
            message: 'Points awarded to phone-based customer record'
        };
    } catch (error: any) {
        console.error("Error awarding points by phone:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get points for customer by phone number (for customers without LINE ID)
 */
export async function getPointsByPhone(phoneNumber: string, auth?: AuthContext) {
    if (!phoneNumber) {
        return { success: false, error: 'Phone number is required' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const customerRef = db.collection('customers_by_phone').doc(phoneNumber);
        const customerDoc = await customerRef.get();

        if (customerDoc.exists) {
            const customerData = customerDoc.data();
            return {
                success: true,
                points: customerData?.points || 0,
                customerInfo: {
                    phoneNumber: customerData?.phoneNumber,
                    lastAppointmentId: customerData?.lastAppointmentId,
                    lastPointsAwarded: customerData?.lastPointsAwarded,
                    lastPointsDate: customerData?.lastPointsDate,
                    hasLineId: false,
                    createdAt: customerData?.createdAt,
                    updatedAt: customerData?.updatedAt
                }
            };
        }

        return {
            success: true,
            points: 0,
            customerInfo: null,
            message: 'No points record found for this phone number'
        };
    } catch (error: any) {
        console.error("Error getting points by phone:", error);
        return { success: false, error: error.message };
    }
}
