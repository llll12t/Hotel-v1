"use server";

import {
    createPaymentFlexTemplate,
    createReviewFlexTemplate,
    createAppointmentConfirmedFlexTemplate,
    createServiceCompletedFlexTemplate,
    createAppointmentCancelledFlexTemplate,
    createNewBookingFlexTemplate,
    createPaymentConfirmationFlexTemplate,
    createReviewThankYouFlexTemplate,
    createAppointmentReminderFlexTemplate,
    createDailyAppointmentNotificationFlexTemplate
} from './flexTemplateActions';

/**
 * Helper function to send Flex Messages via LINE Messaging API.
 */
async function sendFlexMessage(userId: string, flexTemplate: any, actionName: string) {
    try {
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
            console.error('❌ LINE_CHANNEL_ACCESS_TOKEN not found in environment variables');
            return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' };
        }

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                to: userId,
                messages: [flexTemplate]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ LINE API Error Response for ${actionName}:`, {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`LINE API Error: ${response.status} - ${errorText}`);
        }

        return { success: true, message: `${actionName} flex message sent successfully` };

    } catch (error: any) {
        console.error(`Error sending ${actionName} flex message:`, error);
        return { success: false, error: error.message };
    }
}

export async function sendPaymentFlexMessage(userId: string, appointmentData: any) {
    const flexTemplate = await createPaymentFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Payment');
}

export async function sendReviewFlexMessage(userId: string, appointmentData: any) {
    const flexTemplate = await createReviewFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Review');
}

export async function sendAppointmentConfirmedFlexMessage(userId: string, appointmentData: any) {
    const flexTemplate = await createAppointmentConfirmedFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Appointment Confirmed');
}

export async function sendServiceCompletedFlexMessage(userId: string, appointmentData: any) {
    const flexTemplate = await createServiceCompletedFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Service Completed');
}

export async function sendAppointmentCancelledFlexMessage(userId: string, appointmentData: any, reason: string) {
    const flexTemplate = await createAppointmentCancelledFlexTemplate(appointmentData, reason);
    return sendFlexMessage(userId, flexTemplate, 'Appointment Cancelled');
}

export async function sendNewBookingFlexMessage(userId: string, appointmentData: any) {
    const flexTemplate = await createNewBookingFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'New Booking');
}

export async function sendPaymentConfirmationFlexMessage(userId: string, appointmentData: any) {
    const flexTemplate = await createPaymentConfirmationFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Payment Confirmation');
}

export async function sendReviewThankYouFlexMessage(userId: string, pointsAwarded = 0) {
    const flexTemplate = await createReviewThankYouFlexTemplate({ pointsAwarded });
    return sendFlexMessage(userId, flexTemplate, 'Review Thank You');
}

export async function sendAppointmentReminderFlexMessage(userId: string, bookingData: any) {
    const flexTemplate = await createAppointmentReminderFlexTemplate(bookingData);
    return sendFlexMessage(userId, flexTemplate, 'Appointment Reminder');
}

export async function sendDailyAppointmentNotificationFlexMessage(userId: string, appointmentData: any) {
    const flexTemplate = await createDailyAppointmentNotificationFlexTemplate(appointmentData);
    return sendFlexMessage(userId, flexTemplate, 'Daily Appointment Notification');
}
