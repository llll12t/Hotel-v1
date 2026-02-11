"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import {
    sendBookingNotification
} from './lineActions';
import {
    sendServiceCompletedFlexMessage,
    sendReviewFlexMessage,
    sendPaymentConfirmationFlexMessage
} from './lineFlexActions';
import { awardPointsForPurchase, awardPointsForVisit } from './pointActions';
import { findOrCreateCustomer } from './customerActions';
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

// --- Helper to get notification settings ---
const getNotificationSettings = async () => {
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    return settingsDoc.exists ? settingsDoc.data() : {};
};

const requireEmployeeAuth = async (auth?: AuthContext) => {
    // 1. Check Admin Auth first (allow admins to act as employees)
    if (auth?.adminToken) {
        const adminCheck = await requireAdminAuth(auth);
        if (adminCheck.ok && adminCheck.value) {
            return { ok: true, employeeId: adminCheck.value.uid || 'admin', lineUserId: 'admin' };
        }
    }

    // 2. Check LINE Auth
    const lineAuth = await requireLineAuth(auth);
    if (!lineAuth.ok) return { ok: false, error: lineAuth.error };
    const lineUserId = lineAuth.value.userId;
    if (!lineUserId) return { ok: false, error: 'Missing LINE user.' };

    const snapshot = await db.collection('employees').where('lineUserId', '==', lineUserId).limit(1).get();
    if (snapshot.empty) {
        return { ok: false, error: 'Employee access denied.' };
    }

    return { ok: true, employeeId: snapshot.docs[0].id, lineUserId };
};

// --- Registration and Status Updates ---

export async function registerLineIdToEmployee(phoneNumber: string, lineUserId: string) {
    if (!phoneNumber || !lineUserId) {
        return { success: false, error: 'Phone number and LINE User ID are required.' };
    }
    const employeesRef = db.collection('employees');
    const q = employeesRef.where('phoneNumber', '==', phoneNumber).limit(1);
    const snapshot = await q.get();

    if (snapshot.empty) {
        return { success: false, error: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ' };
    }
    const employeeDoc = snapshot.docs[0];
    if (employeeDoc.data().lineUserId) {
        return { success: false, error: 'เบอร์นี้ถูกผูกกับบัญชี LINE อื่นแล้ว' };
    }

    try {
        await employeeDoc.ref.update({ lineUserId: lineUserId });
        return { success: true, message: 'ยืนยันตัวตนสำเร็จ' };
    } catch (error) {
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
    }
}

export async function updateAppointmentStatus(appointmentId: string, newStatus: string, employeeId: string, auth?: AuthContext) {
    if (!appointmentId || !newStatus || !employeeId) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };
        const effectiveEmployeeId = employeeAuth.employeeId;

        const [appointmentDoc, settings] = await Promise.all([
            appointmentRef.get(),
            getNotificationSettings()
        ]);

        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลนัดหมาย");

        const appointmentData: any = appointmentDoc.data();
        const settingsData: any = settings || {};
        const notificationsEnabled = settingsData.allNotifications?.enabled;
        const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

        const updateData: any = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (newStatus === 'in_progress') {
            updateData['timeline.startedAt'] = FieldValue.serverTimestamp();
            updateData['timeline.checkedInBy'] = effectiveEmployeeId;
        } else if (newStatus === 'completed') {
            updateData['timeline.completedAt'] = FieldValue.serverTimestamp();
        } else if (newStatus === 'cancelled') {
            updateData['timeline.cancelledAt'] = FieldValue.serverTimestamp();
            updateData['timeline.cancelledBy'] = `employee:${effectiveEmployeeId}`;
            updateData['timeline.cancellationReason'] = 'Cancelled by employee';
        }

        await appointmentRef.update(updateData);

        // --- Conditional Notifications ---
        if (appointmentData.userId) {
            const notificationPayload: any = {
                ...appointmentData,
                id: appointmentId,
                appointmentId: appointmentId,
            };

            if (newStatus === 'completed') {
                const totalPrice = appointmentData.paymentInfo?.totalPrice || 0;
                let totalPointsAwarded = 0;
                if (totalPrice > 0) {
                    const purchasePointsResult = await awardPointsForPurchase(appointmentData.userId, totalPrice);
                    if (purchasePointsResult.success) totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
                }
                const visitPointsResult = await awardPointsForVisit(appointmentData.userId);
                if (visitPointsResult.success) totalPointsAwarded += visitPointsResult.pointsAwarded || 0;

                notificationPayload.totalPointsAwarded = totalPointsAwarded;

                if (customerNotificationsEnabled && settingsData.customerNotifications?.serviceCompleted) {
                    await sendServiceCompletedFlexMessage(appointmentData.userId, notificationPayload);
                }

                if (customerNotificationsEnabled && settingsData.customerNotifications?.reviewRequest) {
                    await sendReviewFlexMessage(appointmentData.userId, notificationPayload);
                }
            }
        }

        if (appointmentData.customerInfo && (appointmentData.userId || appointmentData.customerInfo.phone)) {
            await findOrCreateCustomer(appointmentData.customerInfo, appointmentData.userId);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error updating appointment status:", error);
        return { success: false, error: error.message };
    }
}

export async function updatePaymentStatusByEmployee(appointmentId: string, employeeId: string, auth?: AuthContext) {
    if (!appointmentId || !employeeId) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const [appointmentDoc, settings] = await Promise.all([
            appointmentRef.get(),
            getNotificationSettings()
        ]);

        if (!appointmentDoc.exists) {
            throw new Error("ไม่พบข้อมูลนัดหมาย!");
        }
        const appointmentData: any = appointmentDoc.data();
        const settingsData: any = settings || {};

        await appointmentRef.update({
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            'paymentInfo.paymentReceivedBy': effectiveEmployeeId,
            updatedAt: FieldValue.serverTimestamp()
        });

        const userId = appointmentData.userId;
        const totalPrice = appointmentData.paymentInfo?.totalPrice || 0;
        let totalPointsAwarded = 0;

        if (userId) {
            if (totalPrice > 0) {
                const purchasePointsResult = await awardPointsForPurchase(userId, totalPrice);
                if (purchasePointsResult.success) totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
            }
            const visitPointsResult = await awardPointsForVisit(userId);
            if (visitPointsResult.success) totalPointsAwarded += visitPointsResult.pointsAwarded || 0;
        }

        // --- Conditional Admin Notification ---
        const adminNotificationsEnabled = settingsData.allNotifications?.enabled && settingsData.adminNotifications?.enabled;
        if (adminNotificationsEnabled && settingsData.adminNotifications?.paymentReceived) {
            try {
                const notificationData = {
                    customerName: appointmentData.customerInfo?.fullName || 'ลูกค้า',
                    serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                    appointmentDate: appointmentData.date,
                    appointmentTime: appointmentData.time,
                    totalPrice: appointmentData.paymentInfo.totalPrice
                };
                await sendBookingNotification(notificationData, 'paymentReceived');
            } catch (notificationError) {
                console.error('Error sending payment notification to admin:', notificationError);
            }
        }

        // --- Conditional Customer Notification for Payment ---
        const customerNotificationsEnabled = settingsData.allNotifications?.enabled && settingsData.customerNotifications?.enabled;
        if (customerNotificationsEnabled && settingsData.customerNotifications?.paymentInvoice && userId) {
            try {
                const payload = { ...appointmentData, id: appointmentId, appointmentId: appointmentId };
                await sendPaymentConfirmationFlexMessage(userId, payload);
            } catch (notificationError) {
                console.error('Error sending payment invoice to customer:', notificationError);
            }
        }

        return {
            success: true,
            pointsAwarded: totalPointsAwarded
        };

    } catch (error: any) {
        console.error("Error updating payment status by employee:", error);
        return { success: false, error: error.message };
    }
}


// --- Appointment Lookups ---

export async function findAppointmentsByPhone(phoneNumber: string, auth?: AuthContext) {
    if (!phoneNumber) return { success: false, error: "Phone number is required." };
    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };

        const todayStr = new Date().toISOString().split('T')[0];

        const q = db.collection('appointments')
            .where('customerInfo.phone', '==', phoneNumber)
            // [UPDATED] เพิ่มสถานะ 'in_progress' เข้าไปในการค้นหา
            .where('status', 'in', ['confirmed', 'awaiting_confirmation', 'pending', 'in_progress'])
            .orderBy('date', 'asc')
            .orderBy('time', 'asc');

        const snapshot = await q.get();
        const appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, appointments: JSON.parse(JSON.stringify(appointments)) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function findAppointmentById(appointmentId: string, auth?: AuthContext) {
    if (!appointmentId) return { success: false, error: "Appointment ID is required." };
    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };

        const docRef = db.collection('appointments').doc(appointmentId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const appointment = { id: docSnap.id, ...docSnap.data() };
            return { success: true, appointment: JSON.parse(JSON.stringify(appointment)) };
        } else {
            return { success: false, error: "Appointment not found." };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Admin-related actions ---
export async function promoteEmployeeToAdmin(employeeId: string, auth?: AuthContext) {
    if (!employeeId) {
        return { success: false, error: 'Employee ID is required.' };
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const adminRef = db.collection('admins').doc(employeeId);

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.runTransaction(async (transaction: any) => {
            const employeeDoc = await transaction.get(employeeRef);
            if (!employeeDoc.exists) {
                throw new Error("ไม่พบข้อมูลพนักงานคนดังกล่าว");
            }
            const employeeData = employeeDoc.data();
            const adminData = {
                ...employeeData,
                role: 'admin',
                promotedAt: FieldValue.serverTimestamp(),
            };
            transaction.set(adminRef, adminData);
            transaction.delete(employeeRef);
        });

        revalidatePath('/employees');
        revalidatePath(`/employees/${employeeId}`);

        return { success: true };
    } catch (error: any) {
        console.error("Error promoting employee:", error);
        return { success: false, error: error.message };
    }
}

export async function fetchEmployees(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const employeesRef = db.collection('employees');
        const employeeSnapshot = await employeesRef.get();

        const employees = employeeSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'employee',
        }));

        const sortedEmployees = employees.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate() || 0;
            const dateB = b.createdAt?.toDate() || 0;
            return dateB - dateA;
        });

        return { success: true, employees: JSON.parse(JSON.stringify(sortedEmployees)) };
    } catch (error: any) {
        console.error("Error fetching employees:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteEmployee(employeeId: string, auth?: AuthContext) {
    if (!employeeId) {
        return { success: false, error: 'Employee ID is required.' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const docRef = db.collection('employees').doc(employeeId);
        await docRef.delete();
        revalidatePath('/employees');
        return { success: true };
    } catch (error: any) {
        console.error(`Error deleting employee ${employeeId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function updateEmployeeStatus(employeeId: string, status: string, auth?: AuthContext) {
    if (!employeeId || !status) {
        return { success: false, error: 'Employee ID and status are required.' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const docRef = db.collection('employees').doc(employeeId);
        await docRef.update({
            status: status,
            updatedAt: new Date()
        });
        revalidatePath('/employees');
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating employee ${employeeId} status:`, error);
        return { success: false, error: error.message };
    }
}
