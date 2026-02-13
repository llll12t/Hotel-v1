"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

export interface RewardData {
    name: string;
    pointsRequired: number;
    description?: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    value?: number; // legacy support
}

export async function addReward(rewardData: RewardData, auth?: AuthContext) {
    if (!rewardData.name || !rewardData.pointsRequired) {
        return { success: false, error: 'Missing required fields.' };
    }
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('rewards').add({
            ...rewardData,
            createdAt: FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function redeemReward(userId: string, rewardId: string, auth?: AuthContext) {
    if (!userId || !rewardId) {
        return { success: false, error: "User ID and Reward ID are required." };
    }

    const lineAuth = await requireLineAuth(auth);
    if (!lineAuth.ok) return { success: false, error: lineAuth.error };
    const lineUserId = lineAuth.value.userId || userId;
    if (!lineUserId) return { success: false, error: "Missing LINE user." };
    if (lineUserId !== userId) {
        return { success: false, error: "Unauthorized." };
    }

    const customerRef = db.collection('customers').doc(userId);
    const rewardRef = db.collection('rewards').doc(rewardId);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const [customerDoc, rewardDoc] = await Promise.all([
                transaction.get(customerRef),
                transaction.get(rewardRef)
            ]);

            if (!customerDoc.exists) throw new Error("Customer not found.");
            if (!rewardDoc.exists) throw new Error("Reward not found.");

            const customer = customerDoc.data();
            const reward = rewardDoc.data();

            if (!customer || !reward) throw new Error("Data invalid.");

            const currentPoints = customer.points || 0;

            if (currentPoints < reward.pointsRequired) {
                throw new Error("Not enough points.");
            }

            const newPoints = currentPoints - reward.pointsRequired;

            // Update customer points
            transaction.update(customerRef, { points: newPoints });

            // Create a new coupon for the customer
            const couponRef = customerRef.collection('coupons').doc();
            transaction.set(couponRef, {
                rewardId: rewardId,
                name: reward.name,
                description: reward.description || '',
                discountType: reward.discountType || 'percentage', // 'percentage' หรือ 'fixed'
                discountValue: reward.discountValue || reward.value || 0, // จำนวนส่วนลด
                redeemedAt: FieldValue.serverTimestamp(),
                used: false,
                expiresAt: null, // Can add expiry logic later
            });

            // Increment redeemed count on reward document
            // Use explicit type cast or just increment(1)
            transaction.update(rewardRef, {
                redeemedCount: FieldValue.increment(1)
            });

            return { couponId: couponRef.id };
        });

        return { success: true, ...result };

    } catch (error: any) {
        console.error("Redeem reward error:", error);
        return { success: false, error: error.message };
    }
}
