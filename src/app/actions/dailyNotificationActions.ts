"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { sendDailyAppointmentNotificationFlexMessage } from '@/app/actions/lineFlexActions';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

/**
 * Sends daily appointment notifications to customers immediately (manual trigger)
 * @param {boolean} mockMode - If true, simulates sending without calling LINE API
 */
export async function sendDailyNotificationsNow(mockMode = false, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        // Get today's date in Thailand timezone (YYYY-MM-DD)
        const todayString = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());

        // Query appointments for today with specific statuses
        const appointmentsSnapshot = await db.collection('appointments')
            .where('date', '==', todayString)
            .get();

        if (appointmentsSnapshot.empty) {
            return {
                success: true,
                message: "ไม่มีนัดหมายสำหรับวันนี้",
                data: {
                    totalAppointments: 0,
                    sentCount: 0,
                    failureCount: 0,
                    skipCount: 0,
                    date: todayString
                }
            };
        }

        // Filter appointments by status: only "awaiting_confirmation" and "confirmed"
        const validStatuses = ['awaiting_confirmation', 'confirmed'];
        const filteredAppointments: any[] = [];

        appointmentsSnapshot.forEach(doc => {
            const appointmentData = doc.data();
            if (validStatuses.includes(appointmentData.status)) {
                filteredAppointments.push({
                    id: doc.id,
                    data: appointmentData
                });
            }
        });

        if (filteredAppointments.length === 0) {
            return {
                success: true,
                message: "ไม่มีนัดหมายที่มีสถานะ awaiting_confirmation หรือ confirmed สำหรับวันนี้",
                data: {
                    totalAppointments: appointmentsSnapshot.size,
                    validStatusAppointments: 0,
                    sentCount: 0,
                    failureCount: 0,
                    skipCount: 0,
                    date: todayString
                }
            };
        }

        const notificationPromises: Promise<any>[] = [];

        // Counters will be calculated from results to avoid concurrency issues with simple vars in Promise.all 
        // although Promise.all runs concurrently, vars updated inside then() might be ok if no await/race conditions
        // but better to rely on results.

        filteredAppointments.forEach(appointment => {
            const appointmentData = appointment.data;
            const appointmentId = appointment.id;

            // Check if customer has LINE ID
            if (appointmentData.userId) {
                const notificationData = {
                    id: appointmentId,
                    ...appointmentData
                };

                if (mockMode) {
                    // Mock mode: simulate success without calling LINE API
                    notificationPromises.push(
                        Promise.resolve({
                            appointmentId,
                            success: true,
                            mockMode: true
                        })
                    );
                } else {
                    // Real mode: call LINE API
                    notificationPromises.push(
                        sendDailyAppointmentNotificationFlexMessage(appointmentData.userId, notificationData)
                            .then((result: any) => {
                                if (result.success) {
                                    return { appointmentId, success: true };
                                } else {
                                    console.error(`Failed to send daily notification to ${appointmentData.userId}:`, result.error);
                                    return { appointmentId, success: false, error: result.error };
                                }
                            })
                            .catch((error: any) => {
                                console.error(`Error sending daily notification for appointment ${appointmentId}:`, error);
                                return { appointmentId, success: false, error: error.message };
                            })
                    );
                }
            } else {
                // No LINE ID, considered skipped
                notificationPromises.push(Promise.resolve({ appointmentId, success: false, skipped: true }));
            }
        });

        // Wait for all notifications to be sent
        const results = await Promise.all(notificationPromises);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success && !r.skipped).length;
        const skipCount = results.filter(r => r.skipped).length;

        const statusText = mockMode ? 'ทดสอบส่งแจ้งเตือน' : 'ส่งแจ้งเตือน';
        const message = `${statusText}สำเร็จ ${successCount}/${filteredAppointments.length} คน (จากการจองที่มีสถานะรอยืนยัน/ยืนยันแล้ว)`;

        return {
            success: true,
            message,
            data: {
                totalAppointments: appointmentsSnapshot.size,
                validStatusAppointments: filteredAppointments.length,
                sentCount: successCount,
                failureCount,
                skipCount,
                date: todayString
            }
        };

    } catch (error: any) {
        console.error("Manual daily notification error:", error);
        return {
            success: false,
            error: error.message
        };
    }
}
