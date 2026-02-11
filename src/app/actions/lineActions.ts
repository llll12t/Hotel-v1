"use server";

import { Client } from '@line/bot-sdk';
import { db } from '@/app/lib/firebaseAdmin';
import { sendAppointmentReminderFlexMessage as sendReminderFlex } from './lineFlexActions'; // Fix circular dependency import name if needed
import { getNotificationSettings, getShopProfile } from './settingsActions';
import { sendTelegramMessageToAdmin } from './telegramActions';

const client = new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

/**
 * Sends a push message to a single LINE user, checking customer notification settings first.
 */
export async function sendLineMessage(to: string, messageText: string, notificationType: string) {
    if (!to || !messageText) {
        console.error("Missing 'to' or 'messageText'");
        return { success: false, error: "Missing recipient or message." };
    }

    const { success, settings } = await getNotificationSettings();
    if (!success || !settings?.customerNotifications?.[notificationType]) {
        console.log(`Customer notification for type '${notificationType}' is disabled.`);
        return { success: true, message: "Customer notifications disabled for this type." };
    }

    try {
        const messageObject = { type: 'text', text: messageText } as const;
        await client.pushMessage(to, [messageObject]); // SDK expects array
        return { success: true };
    } catch (error: any) {
        console.error(`Failed to send message to ${to}:`, error.originalError?.response?.data || error);
        return { success: false, error: 'Failed to send message' };
    }
}

/**
 * Sends a multicast message to all registered admins, checking admin notification settings first.
 */
export async function sendLineMessageToAllAdmins(messageText: string, notificationType: string) {
    const { success, settings } = await getNotificationSettings();
    if (!success || !settings?.lineNotifications?.enabled || (notificationType && !settings?.adminNotifications?.[notificationType])) {
        console.log(`Admin LINE notification for type '${notificationType}' is disabled.`);
        return { success: true, message: "Admin notifications disabled for this type." };
    }

    try {
        const adminsQuery = db.collection('admins').where("lineUserId", "!=", null);
        const adminSnapshot = await adminsQuery.get();

        if (adminSnapshot.empty) {
            console.warn("No admins with lineUserId found to notify.");
            return { success: true, message: "No admins to notify." };
        }

        const adminLineIds = adminSnapshot.docs.map((doc: any) => doc.data().lineUserId).filter((id: any) => id);

        if (adminLineIds.length > 0) {
            const messageObject = { type: 'text', text: messageText } as const;
            await client.multicast(adminLineIds, [messageObject]);
        }

        return { success: true };

    } catch (error: any) {
        console.error('Error sending multicast message to admins:', error.originalError?.response?.data || error);
        return { success: false, error: 'Failed to send message to admins' };
    }
}

/**
 * Send booking notification to admins via LINE Notify and LINE Bot
 */
async function createMessage(details: any, type: string) {
    const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice } = details;
    const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';

    switch (type) {
        case 'newBooking':
            return `
✅ จองคิวใหม่
ลูกค้า: ${customerName}
บริการ: ${serviceName}
วันที่: ${formattedDate}
เวลา: ${appointmentTime} น.
ยอดรวม: ${totalPrice.toLocaleString()} ${currencySymbol}`;
        case 'paymentReceived':
            return `
💰 ได้รับชำระเงิน
ลูกค้า: ${customerName}
บริการ: ${serviceName}
วันที่: ${formattedDate}
เวลา: ${appointmentTime} น.
ยอดชำระ: ${totalPrice.toLocaleString()} ${currencySymbol}`;
        case 'customerConfirmed':
            return `
👍 ลูกค้ายืนยันนัดหมาย
ลูกค้า: ${customerName}
บริการ: ${serviceName}
วันที่: ${formattedDate}
เวลา: ${appointmentTime} น.`;
        default:
            return `
🔔 การแจ้งเตือนใหม่
ลูกค้า: ${customerName}
บริการ: ${serviceName}
วันที่: ${formattedDate}
เวลา: ${appointmentTime} น.`;
    }
}

export async function sendBookingNotification(details: any, type: string) {
    const { success, settings } = await getNotificationSettings();

    if (!success) {
        console.error("Could not retrieve notification settings.");
        const telegramMessage = `[Fallback from LINE - Settings Error] ${await createMessage(details, type)}`;
        await sendTelegramMessageToAdmin(telegramMessage);
        return { success: false, error: "Could not retrieve notification settings." };
    }

    const isAdminLineEnabled = settings?.lineNotifications?.enabled;
    const isNotificationTypeEnabled = settings?.adminNotifications?.[type];

    if (!isAdminLineEnabled || !isNotificationTypeEnabled) {
        console.log(`Admin LINE notification for type '${type}' is disabled.`);
        if (settings?.adminNotifications?.telegram?.enabled) {
            const telegramMessage = `[Fallback from LINE] ${await createMessage(details, type)}`;
            await sendTelegramMessageToAdmin(telegramMessage);
        }
        return { success: true, message: `Admin notification for ${type} disabled.` };
    }

    const message = await createMessage(details, type);

    if (settings?.lineNotifications?.notifyToken) {
        try {
            await fetch('https://notify-api.line.me/api/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${settings.lineNotifications.notifyToken}`,
                },
                body: `message=${encodeURIComponent(message)}`
            });
        } catch (error: any) {
            console.error('Error sending LINE Notify message:', error.message);
            const fallbackMessage = `🚨 LINE Notify Error for ${type}: ${error.message}`;
            await sendTelegramMessageToAdmin(fallbackMessage);
        }
    }

    await sendLineMessageToAllAdmins(message, type);

    return { success: true };
}

export async function sendReminderNotification(customerLineId: string, bookingData: any) {
    // 1. Check settings first
    const { success, settings } = await getNotificationSettings();
    const notificationType = 'appointmentReminder'; // Make sure this key matches your settings structure

    if (!success || !settings?.customerNotifications?.[notificationType]) {
        console.log(`Customer notification for type '${notificationType}' is disabled.`);
        return { success: true, message: `Customer notifications for '${notificationType}' are disabled.` };
    }

    // 2. Send Flex Message
    // Note: We use the alias 'sendReminderFlex' imported from lineFlexActions to avoid circular dependency issues at runtime if possible,
    // though ES modules handle circular deps, sometimes execution order matters.
    // If lineFlexActions calls lineActions, we have a cycle.
    // Assuming lineFlexActions uses a lower-level send function or we are careful.
    // The previous stub suggested moving logic.
    // But here we will try to use the imported function.

    return sendReminderFlex(customerLineId, bookingData);
}
