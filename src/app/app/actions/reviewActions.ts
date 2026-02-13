'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendReviewThankYouFlexMessage } from './lineFlexActions';
import { AuthContext, requireLineAuth } from '@/app/lib/authUtils';

type ReviewAnswer = {
    id?: string;
    question: string;
    score: number;
};

/**
 * Submits a review for a completed appointment.
 * @param {object} reviewData - The review data from the form.
 * @param {string} reviewData.appointmentId - The ID of the appointment being reviewed.
 * @param {string} reviewData.userId - The LINE User ID of the customer.
 * @param {string} reviewData.technicianId - The ID of the technician.
 * @param {number} reviewData.rating - The star rating (1-5).
 * @param {string} reviewData.comment - The customer's comment.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitReview(reviewData: any, auth?: AuthContext) {
    const { appointmentId, userId, technicianId, rating, comment, questionAnswers } = reviewData;
    const numericRating = Number(rating);

    if (!appointmentId || !userId || !numericRating) {
        return { success: false, error: 'ข้อมูลที่จำเป็นไม่ครบถ้วน' };
    }

    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
        return { success: false, error: 'Invalid rating score.' };
    }

    const lineAuth = await requireLineAuth(auth);
    if (!lineAuth.ok) return { success: false, error: lineAuth.error };
    const lineUserId = lineAuth.value.userId || userId;
    if (!lineUserId) return { success: false, error: 'Missing LINE user.' };
    if (lineUserId !== userId) {
        return { success: false, error: 'Unauthorized.' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);
    const reviewRef = db.collection('reviews').doc(appointmentId); // Use appointmentId as reviewId for simplicity

    try {
        // Get point settings first
        const pointSettingsRef = db.collection('settings').doc('points');
        const pointSettingsDoc = await pointSettingsRef.get();

        let pointsToAward = 0;
        if (pointSettingsDoc.exists) {
            const pointSettings = pointSettingsDoc.data();
            if (pointSettings?.enableReviewPoints) {
                pointsToAward = pointSettings.reviewPoints || 5;
            }
        } else {
            // Default: give 5 points for review if no settings found
            pointsToAward = 5;
        }

        await db.runTransaction(async (transaction: any) => {
            // Read all docs first
            const appointmentDoc = await transaction.get(appointmentRef);
            if (!appointmentDoc.exists) {
                throw new Error('ไม่พบข้อมูลการนัดหมายนี้');
            }
            const appointmentData = appointmentDoc.data();
            if (!appointmentData.userId) {
                throw new Error('ข้อมูลการนัดหมายนี้ไม่มี LINE User ID กรุณาติดต่อแอดมิน');
            }
            if (appointmentData.userId !== userId) {
                throw new Error('คุณไม่มีสิทธิ์รีวิวการนัดหมายนี้ กรุณา login ด้วย LINE ที่ใช้จอง');
            }
            if (appointmentData.reviewInfo?.submitted) {
                throw new Error('คุณได้รีวิวการนัดหมายนี้ไปแล้ว');
            }
            if (!appointmentData.customerInfo) {
                throw new Error('ข้อมูลลูกค้าในนัดหมายไม่สมบูรณ์ กรุณาติดต่อแอดมิน');
            }

            const bookingType = appointmentData.bookingType === 'room' ? 'room' : 'service';
            const roomTypeId = appointmentData.roomTypeInfo?.id || appointmentData.bookingInfo?.roomTypeId || null;
            const roomTypeName = appointmentData.roomTypeInfo?.name || appointmentData.serviceInfo?.name || null;
            const serviceName = appointmentData.serviceInfo?.name || roomTypeName || null;
            const technicianName =
                appointmentData.appointmentInfo?.technicianName ||
                `${appointmentData.appointmentInfo?.technicianInfo?.firstName || ''} ${appointmentData.appointmentInfo?.technicianInfo?.lastName || ''}`.trim() ||
                null;

            const normalizedQuestionAnswers: ReviewAnswer[] = [];
            if (Array.isArray(questionAnswers)) {
                questionAnswers.forEach((item: any, index: number) => {
                    const score = Number(item?.score);
                    const question = typeof item?.question === 'string' ? item.question.trim() : '';
                    if (!question || !Number.isFinite(score) || score < 1 || score > 5) return;

                    normalizedQuestionAnswers.push({
                        id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `q_${index + 1}`,
                        question,
                        score,
                    });
                });
            }
            const questionnaireAverage = normalizedQuestionAnswers.length > 0
                ? Number((normalizedQuestionAnswers.reduce((sum, current) => sum + current.score, 0) / normalizedQuestionAnswers.length).toFixed(2))
                : null;

            let customerDoc = null;
            let currentPoints = 0;
            const customerRef = db.collection('customers').doc(userId);
            if (pointsToAward > 0) {
                customerDoc = await transaction.get(customerRef);
                if (customerDoc.exists) {
                    currentPoints = customerDoc.data().points || 0;
                }
            }

            // All reads done, now do writes
            transaction.set(reviewRef, {
                appointmentId,
                userId,
                technicianId: technicianId || null,
                technicianName,
                customerName: appointmentData.customerInfo.fullName || appointmentData.customerInfo.name,
                rating: numericRating,
                comment: comment || '',
                bookingType,
                serviceName,
                roomTypeId,
                roomTypeName,
                questionAnswers: normalizedQuestionAnswers,
                questionnaireAverage,
                pointsAwarded: pointsToAward,
                createdAt: FieldValue.serverTimestamp(),
            });

            transaction.update(appointmentRef, {
                'reviewInfo.submitted': true,
                'reviewInfo.rating': numericRating,
                'reviewInfo.roomTypeId': roomTypeId,
                'reviewInfo.roomTypeName': roomTypeName,
                'reviewInfo.questionAnswers': normalizedQuestionAnswers,
                'reviewInfo.questionnaireAverage': questionnaireAverage,
                'reviewInfo.pointsAwarded': pointsToAward,
                updatedAt: FieldValue.serverTimestamp(),
            });

            if (pointsToAward > 0) {
                if (customerDoc && customerDoc.exists) {
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
            }
        });

        // Send thank you message with points info
        await sendReviewThankYouFlexMessage(userId, pointsToAward);

        return { success: true };
    } catch (error: any) {
        console.error("Error submitting review:", error);
        return { success: false, error: error.message };
    }
}
