'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { sendBookingNotification } from './lineActions';
import {
    sendPaymentFlexMessage,
    sendReviewFlexMessage,
    sendAppointmentConfirmedFlexMessage,
    sendServiceCompletedFlexMessage,
    sendAppointmentCancelledFlexMessage,
    sendNewBookingFlexMessage,
    sendPaymentConfirmationFlexMessage
} from './lineFlexActions';
import { sendTelegramMessageToAdmin } from './telegramActions';
import { awardPointsForPurchase, awardPointsForVisit } from './pointActions';
import { findOrCreateCustomer } from './customerActions';
import { createOrUpdateCalendarEvent, deleteCalendarEvent } from './calendarActions';
import * as settingsActions from './settingsActions';
import { Appointment, Service } from '@/types';
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const getBangkokDateParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = Number(parts.find(p => p.type === 'year')?.value || 0);
    const month = Number(parts.find(p => p.type === 'month')?.value || 0);
    const day = Number(parts.find(p => p.type === 'day')?.value || 0);
    return { year, month, day };
};

const getBangkokEndOfDay = (date = new Date()) => {
    const { year, month, day } = getBangkokDateParts(date);
    const utcMillis = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - BANGKOK_OFFSET_MS;
    return new Date(utcMillis);
};

const toDateSafe = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
};

const ACTIVE_ROOM_BOOKING_STATUSES = ['pending', 'awaiting_confirmation', 'confirmed', 'in_progress'] as const;

const isDateOverlap = (checkInA: string, checkOutA: string, checkInB?: string, checkOutB?: string) => {
    if (!checkInB || !checkOutB) return false;
    return checkInA < checkOutB && checkOutA > checkInB;
};

// Re-exporting createAppointmentWithSlotCheck for brevity (it was correct in previous step)
export async function createAppointmentWithSlotCheck(appointmentData: any, auth?: AuthContext) {
    const { date, time, serviceId, technicianId } = appointmentData;
    if (!date || !time) return { success: false, error: 'กรุณาระบุวันและเวลา' };
    try {
        let resolvedUserId: string | undefined = appointmentData.userId;
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) {
            const lineAuth = await requireLineAuth(auth);
            if (!lineAuth.ok) {
                return { success: false, error: lineAuth.error };
            }
            const lineUserId = lineAuth.value.userId;
            if (lineUserId && resolvedUserId && lineUserId !== resolvedUserId) {
                return { success: false, error: 'LINE user mismatch.' };
            }
            if (!lineUserId && !resolvedUserId && process.env.NODE_ENV === 'production') {
                return { success: false, error: 'Missing LINE user.' };
            }
            resolvedUserId = lineUserId || resolvedUserId;
        }

        const settingsRef = db.collection('settings').doc('booking');
        const settingsSnap = await settingsRef.get();

        let maxSlot = 1;
        let useTechnician = false;

        if (settingsSnap.exists) {
            const data = settingsSnap.data();
            useTechnician = !!(data?.useTechnician ?? data?.useBeautician);
            if (data?.totalTechnicians || data?.totalBeauticians) {
                maxSlot = Number(data?.totalTechnicians ?? data?.totalBeauticians);
            }
            if (Array.isArray(data?.timeQueues) && data.timeQueues.length > 0) {
                const specificQueue = data.timeQueues.find((q: any) => q.time === time);
                if (specificQueue && typeof specificQueue.count === 'number') {
                    maxSlot = specificQueue.count;
                }
            }
        }

        let queryConditions: any[] = [
            ['date', '==', date],
            ['time', '==', time],
            ['status', 'in', ['pending', 'confirmed', 'awaiting_confirmation', 'blocked']]
        ];

        if (useTechnician && technicianId && technicianId !== 'auto-assign') {
            queryConditions.push(['technicianId', '==', technicianId]);
            maxSlot = 1;
        }

        let q: any = db.collection('appointments');
        queryConditions.forEach(condition => {
            q = q.where(...condition);
        });

        const snap = await q.get();
        if (snap.size >= maxSlot) {
            const errorMsg = useTechnician && technicianId !== 'auto-assign'
                ? 'ช่างท่านนี้ไม่ว่างในช่วงเวลาดังกล่าว'
                : 'ช่วงเวลานี้ถูกจองเต็มแล้ว';
            return { success: false, error: errorMsg };
        }

        const serviceRef = db.collection('services').doc(serviceId);
        const serviceSnap = await serviceRef.get();
        if (!serviceSnap.exists) {
            return { success: false, error: 'ไม่พบบริการที่เลือก' };
        }
        const authoritativeServiceData = serviceSnap.data() as Service;

        let finalPrice = authoritativeServiceData.price || 0;
        let finalDuration = authoritativeServiceData.duration || 0;
        let selectedArea = null;
        let selectedPackage = null;

        if (authoritativeServiceData.serviceType === 'multi-area' && authoritativeServiceData.areas && authoritativeServiceData.areas.length > 0) {
            const areaIndex = appointmentData.appointmentInfo?.areaIndex;
            const packageIndex = appointmentData.appointmentInfo?.packageIndex;

            if (areaIndex !== null && areaIndex !== undefined && authoritativeServiceData.areas[areaIndex]) {
                selectedArea = authoritativeServiceData.areas[areaIndex] || null;
                finalPrice = selectedArea.price || 0;
                finalDuration = selectedArea.duration || 0;

                if (packageIndex !== null && packageIndex !== undefined && selectedArea.packages && selectedArea.packages[packageIndex]) {
                    selectedPackage = selectedArea.packages[packageIndex] || null;
                    finalPrice = selectedPackage.price || 0;
                    finalDuration = selectedPackage.duration || 0;
                }
            }
        }

        if (authoritativeServiceData.serviceType === 'area-based-options' && authoritativeServiceData.areaOptions) {
            finalPrice = 0;
            finalDuration = 0;
            const selectedOptions = appointmentData.appointmentInfo?.selectedAreaOptions || [];
            if (Array.isArray(selectedOptions)) {
                selectedOptions.forEach((selected: any) => {
                    const areaGroup = authoritativeServiceData.areaOptions?.find(g => g.areaName === selected.areaName);
                    if (areaGroup) {
                        const option = areaGroup.options.find(o => o.name === selected.optionName);
                        if (option) {
                            finalPrice += Number(option.price) || 0;
                            finalDuration += Number(option.duration) || 0;
                        }
                    }
                });
            }
        }

        const addOns = appointmentData.appointmentInfo?.addOns || [];
        const addOnsTotal = addOns.reduce((sum: number, a: any) => sum + (a.price || 0), 0);
        const addOnsDuration = addOns.reduce((sum: number, a: any) => sum + (a.duration || 0), 0);

        finalPrice += addOnsTotal;
        finalDuration += addOnsDuration;

        const subtotal = finalPrice;
        let discountAmount = 0;
        let appliedCoupon: { id: string; name?: string; discountType?: string; discountValue?: number } | null = null;

        const couponId = appointmentData.paymentInfo?.couponId;
        if (couponId) {
            if (!resolvedUserId) {
                return { success: false, error: 'Coupon requires LINE user.' };
            }
            const couponRef = db.collection('customers').doc(resolvedUserId).collection('coupons').doc(couponId);
            const couponSnap = await couponRef.get();
            if (!couponSnap.exists) {
                return { success: false, error: 'Invalid coupon.' };
            }
            const couponData = couponSnap.data() as any;
            if (couponData?.used) {
                return { success: false, error: 'Coupon already used.' };
            }
            const discountType = couponData?.discountType;
            const discountValue = Number(couponData?.discountValue || 0);
            if (discountType === 'percentage') {
                discountAmount = Math.round(subtotal * (discountValue / 100));
            } else if (discountType === 'fixed') {
                discountAmount = discountValue;
            } else {
                return { success: false, error: 'Invalid coupon type.' };
            }
            discountAmount = Math.min(discountAmount, subtotal);
            appliedCoupon = {
                id: couponId,
                name: couponData?.name,
                discountType,
                discountValue,
            };
        }

        const totalPrice = Math.max(0, subtotal - discountAmount);

        const incomingStatus = appointmentData.status;
        const finalStatus = incomingStatus && incomingStatus !== 'awaiting_confirmation' ? incomingStatus : 'pending';
        const paymentDueAtDate = toDateSafe(appointmentData.paymentInfo?.paymentDueAt) ?? getBangkokEndOfDay();

        const finalAppointmentData: any = {
            ...appointmentData,
            bookingType: 'service',
            status: finalStatus,
            userId: resolvedUserId,
            serviceInfo: {
                id: serviceId,
                name: authoritativeServiceData.serviceName,
                price: finalPrice,
                duration: finalDuration,
                imageUrl: authoritativeServiceData.imageUrl || '',
                serviceType: typeof authoritativeServiceData.serviceType === 'string' && authoritativeServiceData.serviceType.trim() ? authoritativeServiceData.serviceType : 'single',
                selectedArea: selectedArea ?? null,
                selectedPackage: selectedPackage ?? null,
                areaIndex: appointmentData.appointmentInfo?.areaIndex ?? null,
                packageIndex: appointmentData.appointmentInfo?.packageIndex ?? null,
                selectedAreaOptions: appointmentData.appointmentInfo?.selectedAreaOptions || [],
                addOns: addOns
            },
            appointmentInfo: {
                ...appointmentData.appointmentInfo,
                duration: finalDuration,
                selectedArea: selectedArea ?? null,
                selectedPackage: selectedPackage ?? null,
                areaIndex: appointmentData.appointmentInfo?.areaIndex ?? null,
                packageIndex: appointmentData.appointmentInfo?.packageIndex ?? null,
                addOns: addOns
            },
            paymentInfo: {
                ...appointmentData.paymentInfo,
                basePrice: finalPrice - addOnsTotal,
                addOnsTotal: addOnsTotal,
                originalPrice: subtotal,
                discount: discountAmount,
                couponId: appliedCoupon?.id || null,
                couponName: appliedCoupon?.name || null,
                totalPrice: totalPrice,
                paymentDueAt: Timestamp.fromDate(paymentDueAtDate),
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const newRef = db.collection('appointments').doc();
        await newRef.set(finalAppointmentData);

        await createOrUpdateCalendarEvent(newRef.id, finalAppointmentData);

        if (appointmentData.customerInfo && (resolvedUserId || appointmentData.customerInfo.phone)) {
            try {
                await findOrCreateCustomer(appointmentData.customerInfo, resolvedUserId);
            } catch (customerError) {
                console.error(`Error creating customer for appointment ${newRef.id}:`, customerError);
            }
        }

        if (appliedCoupon && resolvedUserId) {
            await db.collection('customers').doc(resolvedUserId).collection('coupons').doc(appliedCoupon.id).update({
                used: true,
                usedAt: FieldValue.serverTimestamp(),
                appointmentId: newRef.id
            });
        }

        const { success: settingsSuccess, settings: notificationSettings } = await settingsActions.getNotificationSettings();
        if (settingsSuccess && resolvedUserId && notificationSettings?.customerNotifications?.newBooking) {
            await sendNewBookingFlexMessage(resolvedUserId, {
                serviceName: finalAppointmentData.serviceInfo.name,
                date: date,
                time: time,
                appointmentId: newRef.id,
                id: newRef.id
            });
        }

        try {
            const notificationData = {
                customerName: finalAppointmentData.customerInfo?.fullName || 'ลูกค้า',
                serviceName: finalAppointmentData.serviceInfo?.name || 'บริการ',
                appointmentDate: date,
                appointmentTime: time,
                totalPrice: finalAppointmentData.paymentInfo?.totalPrice ?? 0
            };
            await sendBookingNotification(notificationData, 'newBooking');
        } catch (notificationError) {
            console.error('Error sending admin notification:', notificationError);
        }

        return { success: true, id: newRef.id };
    } catch (error: any) {
        console.error('Error creating appointment:', error);
        return { success: false, error: error.message };
    }
}

// Create Room Booking (for hotel/room reservations)
export async function createBooking(bookingData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        let resolvedUserId: string | undefined = bookingData.userId;
        if (!adminAuth.ok) {
            const lineAuth = await requireLineAuth(auth);
            if (!lineAuth.ok) return { success: false, error: lineAuth.error };
            const lineUserId = lineAuth.value.userId;
            if (lineUserId && resolvedUserId && lineUserId !== resolvedUserId) return { success: false, error: 'LINE user mismatch.' };
            resolvedUserId = lineUserId || resolvedUserId;
        }

        const { roomTypeId, checkInDate, checkOutDate, nights: nightsParam, rooms } = bookingData;
        if (!roomTypeId || !checkInDate || !checkOutDate) return { success: false, error: 'Missing booking dates or room type.' };

        const rtRef = db.collection('roomTypes').doc(roomTypeId);
        const rtSnap = await rtRef.get();
        if (!rtSnap.exists) return { success: false, error: 'Room type not found.' };
        const rtData: any = rtSnap.data();

        const nights = nightsParam ? Number(nightsParam) : Math.max(1, Math.round((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)) || 1);
        const roomsCount = rooms ? Number(rooms) : 1;
        const basePrice = Number(rtData.basePrice || 0);
        const computedOriginal = basePrice * nights * roomsCount;
        const incomingOriginal = Number(bookingData.paymentInfo?.originalPrice);
        const incomingDiscount = Number(bookingData.paymentInfo?.discount);
        const incomingTotal = Number(bookingData.paymentInfo?.totalPrice);
        const originalPrice = Number.isFinite(incomingOriginal) && incomingOriginal > 0 ? incomingOriginal : computedOriginal;
        const discount = Number.isFinite(incomingDiscount) && incomingDiscount > 0 ? Math.min(incomingDiscount, originalPrice) : 0;
        const totalPrice = Number.isFinite(incomingTotal) && incomingTotal > 0 ? incomingTotal : Math.max(0, originalPrice - discount);

        const checkInDateObj = new Date(`${checkInDate}T00:00:00`);
        const appointmentDateTime = Timestamp.fromDate(checkInDateObj);

        // Assign room immediately at booking time and prevent overbooking.
        const roomsSnap = await db.collection('rooms').where('roomTypeId', '==', roomTypeId).get();
        const roomDocs = roomsSnap.docs.filter((d: any) => {
            const status = (d.data()?.status || '').toString();
            return !status || status === 'available';
        });
        if (roomDocs.length === 0) {
            return { success: false, error: 'No room inventory for this room type.' };
        }

        const roomBookingsSnap = await db.collection('appointments').where('bookingType', '==', 'room').get();
        let reservedRoomsCount = 0;
        const occupiedRoomIds = new Set<string>();
        roomBookingsSnap.docs.forEach((docSnap: any) => {
            const data = docSnap.data() || {};
            if (!ACTIVE_ROOM_BOOKING_STATUSES.includes(data.status)) return;
            const info = data.bookingInfo || {};
            if (info.roomTypeId !== roomTypeId) return;
            if (!isDateOverlap(checkInDate, checkOutDate, info.checkInDate, info.checkOutDate)) return;

            reservedRoomsCount += Number(info.rooms || 1);
            if (info.roomId) occupiedRoomIds.add(info.roomId);
        });

        if (reservedRoomsCount + roomsCount > roomDocs.length) {
            return { success: false, error: 'Room is fully booked for selected dates.' };
        }

        const assignedRoomDoc = roomDocs.find((d: any) => !occupiedRoomIds.has(d.id));
        const assignedRoomId = assignedRoomDoc?.id || null;
        const assignedRoomNumber = assignedRoomDoc?.data()?.number || null;

        const incomingStatus = bookingData.status;
        const finalStatus = incomingStatus && incomingStatus !== 'awaiting_confirmation' ? incomingStatus : 'pending';
        const paymentDueAtDate = toDateSafe(bookingData.paymentInfo?.paymentDueAt) ?? getBangkokEndOfDay();

        const finalAppointment: any = {
            ...(resolvedUserId ? { userId: resolvedUserId } : {}),
            bookingType: 'room',
            status: finalStatus,
            date: checkInDate,
            time: bookingData.time || '00:00',
            customerInfo: bookingData.customerInfo || {},
            serviceInfo: {
                id: roomTypeId,
                name: rtData.name,
                imageUrl: rtData.imageUrls?.[0] || null,
                duration: 0,
                serviceType: 'room',
            },
            appointmentInfo: {
                dateTime: appointmentDateTime,
                duration: 0,
                addOns: [],
            },
            bookingInfo: {
                roomTypeId,
                roomId: assignedRoomId,
                roomNumber: assignedRoomNumber,
                checkInDate,
                checkOutDate,
                nights,
                rooms: roomsCount,
                guests: bookingData.guests || null,
            },
            roomTypeInfo: { id: roomTypeId, name: rtData.name, imageUrl: rtData.imageUrls?.[0] || null },
            paymentInfo: {
                ...(bookingData.paymentInfo || {}),
                basePrice,
                originalPrice,
                discount,
                totalPrice,
                paymentStatus: bookingData.paymentInfo?.paymentStatus || 'unpaid',
                paymentDueAt: Timestamp.fromDate(paymentDueAtDate),
            },
            createdBy: bookingData.createdBy || null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const newRef = db.collection('appointments').doc();
        await newRef.set(finalAppointment);

        try {
            await sendBookingNotification({
                customerName: finalAppointment.customerInfo?.fullName || '',
                roomType: rtData.name,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                bookingId: newRef.id,
                totalPrice
            }, 'newBooking');
        } catch (e) {
            console.error('sendBookingNotification failed', e);
        }

        return { success: true, id: newRef.id };
    } catch (error: any) {
        console.error('Error creating booking:', error);
        return { success: false, error: error.message };
    }
}

// Admin: Update Status
export async function updateAppointmentStatusByAdmin(appointmentId: string, newStatus: string, note?: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const updateData: any = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (note) updateData.completionNote = note;

        await db.collection('appointments').doc(appointmentId).update(updateData);

        // Notify user if needed
        const appSnap = await db.collection('appointments').doc(appointmentId).get();
        if (appSnap.exists) {
            const appointment = appSnap.data();
            if (appointment && appointment.userId) {
                if (newStatus === 'confirmed') {
                    await sendAppointmentConfirmedFlexMessage(appointment.userId, { ...appointment, id: appointmentId });
                } else if (newStatus === 'completed') {
                    await sendServiceCompletedFlexMessage(appointment.userId, { ...appointment, id: appointmentId });

                    // Award points
                    try {
                        const price = appointment.paymentInfo?.totalPrice || 0;
                        await awardPointsForPurchase(appointment.userId, price);
                        await awardPointsForVisit(appointment.userId);
                    } catch (e) {
                        console.error("Error awarding points:", e);
                    }
                }
            }
            await createOrUpdateCalendarEvent(appointmentId, { ...appointment, status: newStatus } as any);
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Admin: Confirm Appointment & Payment (Manual)
export async function confirmAppointmentAndPaymentByAdmin(appointmentId: string, adminId: string, data: { amount: number, method: string }, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const appRef = db.collection('appointments').doc(appointmentId);
        const appSnap = await appRef.get();
        if (!appSnap.exists) return { success: false, error: 'Appointment not found' };

        const currentData = appSnap.data();
        const currentStatus = currentData?.status;
        const isAdvanced = currentStatus === 'in_progress' || currentStatus === 'completed';

        const updateData: any = {
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paymentMethod': data.method,
            'paymentInfo.amountPaid': data.amount,
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (!isAdvanced) {
            updateData.status = 'confirmed';
        }

        await appRef.update(updateData);

        const updatedApp = { ...currentData, ...updateData, id: appointmentId };

        await createOrUpdateCalendarEvent(appointmentId, updatedApp);

        if (currentData && currentData.userId) {
            await sendPaymentConfirmationFlexMessage(currentData.userId, updatedApp);
            if (!isAdvanced) {
                await sendAppointmentConfirmedFlexMessage(currentData.userId, updatedApp);
            }
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Admin: Send Invoice
export async function sendInvoiceToCustomer(appointmentId: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const appSnap = await db.collection('appointments').doc(appointmentId).get();
        if (!appSnap.exists) throw new Error("Appointment not found");

        const appointment = appSnap.data();
        if (!appointment?.userId) throw new Error("This appointment is not linked to a LINE user.");

        await db.collection('appointments').doc(appointmentId).update({
            'paymentInfo.paymentStatus': 'invoiced',
            updatedAt: FieldValue.serverTimestamp(),
        });

        await sendPaymentFlexMessage(appointment.userId, { ...appointment, id: appointmentId });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Admin: Cancel
export async function cancelAppointmentByAdmin(appointmentId: string, reason: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled',
            cancelReason: reason,
            updatedAt: FieldValue.serverTimestamp(),
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledBy: 'admin'
        });

        await deleteCalendarEvent(appointmentId);

        const appSnap = await db.collection('appointments').doc(appointmentId).get();
        if (appSnap.exists) {
            const appData = appSnap.data();
            if (appData?.userId) {
                await sendAppointmentCancelledFlexMessage(appData.userId, { id: appointmentId, ...appData }, reason);
            }
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Placeholder for user confirm
export async function confirmAppointmentByUser(appointmentId: string, userId: string, auth?: AuthContext) {
    try {
        const lineAuth = await requireLineAuth(auth);
        if (!lineAuth.ok) return { success: false, error: lineAuth.error };
        const lineUserId = lineAuth.value.userId || userId;
        if (!lineUserId) return { success: false, error: 'Missing LINE user.' };

        const appSnap = await db.collection('appointments').doc(appointmentId).get();
        if (!appSnap.exists) return { success: false, error: 'Appointment not found.' };
        const appointment = appSnap.data();
        if (appointment?.userId !== lineUserId) {
            return { success: false, error: 'Unauthorized.' };
        }

        await db.collection('appointments').doc(appointmentId).update({
            status: 'confirmed',
            updatedAt: FieldValue.serverTimestamp(),
        });
        // Notify admin
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// User Cancel
export async function cancelAppointmentByUser(appointmentId: string, userId: string, auth?: AuthContext) {
    try {
        const lineAuth = await requireLineAuth(auth);
        if (!lineAuth.ok) return { success: false, error: lineAuth.error };
        const lineUserId = lineAuth.value.userId || userId;
        if (!lineUserId) return { success: false, error: 'Missing LINE user.' };

        const appSnap = await db.collection('appointments').doc(appointmentId).get();
        if (!appSnap.exists) return { success: false, error: 'Appointment not found.' };
        const appointment = appSnap.data();
        if (appointment?.userId !== lineUserId) {
            return { success: false, error: 'Unauthorized.' };
        }

        await db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled',
            cancelReason: 'User cancelled',
            updatedAt: FieldValue.serverTimestamp(),
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledBy: 'user'
        });
        await deleteCalendarEvent(appointmentId);
        // Notify admin
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}
