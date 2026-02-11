"use server";

import { Client } from '@line/bot-sdk';
import { db } from '@/app/lib/firebaseAdmin';
import { sendAppointmentReminderFlexMessage as sendReminderFlex } from './lineFlexActions';
import { getNotificationSettings, getShopProfile } from './settingsActions';
import { sendTelegramMessageToAdmin } from './telegramActions';

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
});

const isAllNotificationsEnabled = (settings: any) => settings?.allNotifications?.enabled !== false;
const isCustomerNotificationsEnabled = (settings: any) =>
  isAllNotificationsEnabled(settings) && settings?.customerNotifications?.enabled !== false;
const isAdminNotificationsEnabled = (settings: any) =>
  isAllNotificationsEnabled(settings) && settings?.adminNotifications?.enabled !== false;

const isCustomerTypeEnabled = (settings: any, notificationType: string) =>
  !!settings?.customerNotifications?.[notificationType];
const isAdminTypeEnabled = (settings: any, notificationType: string) =>
  !!settings?.adminNotifications?.[notificationType];

/**
 * Sends a push message to a single LINE user after checking customer notification settings.
 */
export async function sendLineMessage(to: string, messageText: string, notificationType: string) {
  if (!to || !messageText) {
    return { success: false, error: 'Missing recipient or message.' };
  }

  const { success, settings } = await getNotificationSettings();
  if (
    !success ||
    !isCustomerNotificationsEnabled(settings) ||
    !isCustomerTypeEnabled(settings, notificationType)
  ) {
    return { success: true, message: 'Customer notifications disabled for this type.' };
  }

  try {
    const messageObject = { type: 'text', text: messageText } as const;
    await client.pushMessage(to, [messageObject]);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to send message to ${to}:`, error?.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * Sends a multicast message to admins after checking admin notification settings.
 */
export async function sendLineMessageToAllAdmins(messageText: string, notificationType: string) {
  const { success, settings } = await getNotificationSettings();
  if (
    !success ||
    !isAdminNotificationsEnabled(settings) ||
    (notificationType && !isAdminTypeEnabled(settings, notificationType))
  ) {
    return { success: true, message: 'Admin notifications disabled for this type.' };
  }

  try {
    const adminsQuery = db.collection('admins').where('lineUserId', '!=', null);
    const adminSnapshot = await adminsQuery.get();

    if (adminSnapshot.empty) {
      return { success: true, message: 'No admins to notify.' };
    }

    const adminLineIds = adminSnapshot.docs
      .map((doc: any) => doc.data().lineUserId)
      .filter((id: any) => id);

    if (adminLineIds.length > 0) {
      const messageObject = { type: 'text', text: messageText } as const;
      await client.multicast(adminLineIds, [messageObject]);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending multicast message to admins:', error?.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message to admins' };
  }
}

async function createMessage(details: any, type: string) {
  const { customerName, serviceName, appointmentDate, appointmentTime, totalPrice } = details;
  const formattedDate = new Date(appointmentDate).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const { profile } = await getShopProfile();
  const currencySymbol = profile?.currencySymbol || 'บาท';

  switch (type) {
    case 'newBooking':
      return `✅ จองคิวใหม่\nลูกค้า: ${customerName}\nบริการ: ${serviceName}\nวันที่: ${formattedDate}\nเวลา: ${appointmentTime} น.\nยอดรวม: ${Number(totalPrice || 0).toLocaleString()} ${currencySymbol}`;
    case 'paymentReceived':
      return `💰 ได้รับชำระเงิน\nลูกค้า: ${customerName}\nบริการ: ${serviceName}\nวันที่: ${formattedDate}\nเวลา: ${appointmentTime} น.\nยอดชำระ: ${Number(totalPrice || 0).toLocaleString()} ${currencySymbol}`;
    case 'customerConfirmed':
      return `👍 ลูกค้ายืนยันนัดหมาย\nลูกค้า: ${customerName}\nบริการ: ${serviceName}\nวันที่: ${formattedDate}\nเวลา: ${appointmentTime} น.`;
    case 'bookingCancelled':
      return `❌ ยกเลิกการจอง\nลูกค้า: ${customerName}\nบริการ: ${serviceName}\nวันที่: ${formattedDate}\nเวลา: ${appointmentTime} น.`;
    default:
      return `🔔 การแจ้งเตือนใหม่\nลูกค้า: ${customerName}\nบริการ: ${serviceName}\nวันที่: ${formattedDate}\nเวลา: ${appointmentTime} น.`;
  }
}

/**
 * Admin booking notification.
 * Uses LINE Messaging API only to avoid duplicate delivery from legacy LINE Notify.
 */
export async function sendBookingNotification(details: any, type: string) {
  const { success, settings } = await getNotificationSettings();

  if (!success) {
    const telegramMessage = `[Fallback from LINE - Settings Error] ${await createMessage(details, type)}`;
    await sendTelegramMessageToAdmin(telegramMessage);
    return { success: false, error: 'Could not retrieve notification settings.' };
  }

  const isAdminEnabled = isAdminNotificationsEnabled(settings);
  const isTypeEnabled = isAdminTypeEnabled(settings, type);

  if (!isAdminEnabled || !isTypeEnabled) {
    if (settings?.adminNotifications?.telegram?.enabled) {
      const telegramMessage = `[Fallback from LINE] ${await createMessage(details, type)}`;
      await sendTelegramMessageToAdmin(telegramMessage);
    }
    return { success: true, message: `Admin notification for ${type} disabled.` };
  }

  const message = await createMessage(details, type);
  await sendLineMessageToAllAdmins(message, type);
  return { success: true };
}

export async function sendReminderNotification(customerLineId: string, bookingData: any) {
  const { success, settings } = await getNotificationSettings();
  const notificationType = 'appointmentReminder';

  if (
    !success ||
    !isCustomerNotificationsEnabled(settings) ||
    !isCustomerTypeEnabled(settings, notificationType)
  ) {
    return { success: true, message: `Customer notifications for '${notificationType}' are disabled.` };
  }

  return sendReminderFlex(customerLineId, bookingData);
}
