"use server";

import { getShopProfile } from '../settingsActions';
import {
    FLEX_THEME,
    createFlexHeader,
    createFlexInfoCard,
    createSimpleNoticeFlex,
    formatServiceName,
    formatThaiDate,
} from './helpers';

const COLORS = FLEX_THEME.colors;

const summaryRow = (label: string, value: string, valueFlex = 3) => ({
    type: "box",
    layout: "horizontal",
    contents: [
        {
            type: "text",
            text: label,
            size: "sm",
            color: COLORS.muted,
            flex: 2
        },
        {
            type: "text",
            text: value,
            size: "sm",
            color: COLORS.text,
            flex: valueFlex,
            align: "end",
            wrap: true
        }
    ]
});

const getCustomerName = (customerInfo: any) => customerInfo?.fullName || customerInfo?.firstName || 'Customer';

export async function createAppointmentConfirmedFlexTemplate(appointmentData: any) {
    const { serviceInfo, customerInfo, date, time, appointmentInfo } = appointmentData || {};
    const customerName = getCustomerName(customerInfo);
    const serviceName = formatServiceName(serviceInfo || {});
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || 'Assigned at branch';
    const appointmentDate = date ? formatThaiDate(date) : '-';

    return {
        type: "flex",
        altText: "Booking confirmed",
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("Booking confirmed", COLORS.success),
                    {
                        type: "text",
                        text: `Dear ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: "Your booking has been confirmed successfully.",
                        size: "sm",
                        color: COLORS.muted,
                        wrap: true
                    },
                    createFlexInfoCard([
                        summaryRow("Service", serviceName),
                        summaryRow("Date", `${appointmentDate} ${time || ''}`.trim()),
                        summaryRow("Technician", technicianName),
                    ]),
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "Thank you for choosing us.",
                                size: "sm",
                                color: COLORS.success,
                                wrap: true,
                                align: "center"
                            }
                        ],
                        paddingAll: FLEX_THEME.sectionPadding,
                        backgroundColor: COLORS.successSoft,
                        cornerRadius: FLEX_THEME.radius
                    }
                ]
            }
        }
    };
}

export async function createServiceCompletedFlexTemplate(appointmentData: any) {
    const { serviceInfo, customerInfo, totalPointsAwarded, note } = appointmentData || {};
    const customerName = getCustomerName(customerInfo);
    const serviceName = formatServiceName(serviceInfo || {});

    return {
        type: "flex",
        altText: "Service completed",
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("Service completed"),
                    {
                        type: "text",
                        text: `Dear ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: `Your service "${serviceName}" has been completed.`,
                        size: "sm",
                        color: COLORS.muted,
                        wrap: true
                    },
                    ...(totalPointsAwarded && Number(totalPointsAwarded) > 0 ? [{
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "Points earned",
                                size: "md",
                                color: COLORS.muted,
                                flex: 0
                            },
                            {
                                type: "text",
                                text: `${Number(totalPointsAwarded)} pts`,
                                weight: "bold",
                                size: "md",
                                color: COLORS.primary,
                                align: "end"
                            }
                        ],
                        paddingAll: FLEX_THEME.sectionPadding,
                        backgroundColor: COLORS.soft,
                        cornerRadius: FLEX_THEME.radius
                    }] : []),
                    ...(note && note.trim() ? [{
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: note.trim(),
                                size: "sm",
                                color: COLORS.text,
                                wrap: true,
                                align: "center",
                                weight: "bold"
                            }
                        ],
                        paddingAll: FLEX_THEME.sectionPadding,
                        backgroundColor: COLORS.card,
                        cornerRadius: FLEX_THEME.radius
                    }] : []),
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "We appreciate your trust and look forward to serving you again.",
                                size: "sm",
                                color: COLORS.primary,
                                wrap: true,
                                align: "center"
                            }
                        ],
                        paddingAll: FLEX_THEME.sectionPadding,
                        backgroundColor: COLORS.soft,
                        cornerRadius: FLEX_THEME.radius
                    }
                ]
            }
        }
    };
}

export async function createAppointmentCancelledFlexTemplate(appointmentData: any, reason: string) {
    const { serviceInfo, customerInfo, date, time } = appointmentData || {};
    const customerName = getCustomerName(customerInfo);
    const serviceName = formatServiceName(serviceInfo || {});
    const appointmentDate = date ? formatThaiDate(date) : '-';

    return {
        type: "flex",
        altText: "Booking cancelled",
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("Booking cancelled", COLORS.danger),
                    {
                        type: "text",
                        text: `Dear ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: `Your booking for "${serviceName}" has been cancelled.`,
                        size: "sm",
                        color: COLORS.danger,
                        wrap: true
                    },
                    createFlexInfoCard([
                        summaryRow("Date", `${appointmentDate} ${time || ''}`.trim()),
                        summaryRow("Reason", reason || "Not specified"),
                    ], COLORS.dangerSoft),
                ]
            }
        }
    };
}

export async function createNewBookingFlexTemplate(appointmentData: any) {
    const { serviceInfo, customerInfo, date, time } = appointmentData || {};
    const customerName = getCustomerName(customerInfo);
    const serviceName = formatServiceName(serviceInfo || {});
    const appointmentDate = date ? formatThaiDate(date) : '-';

    return {
        type: "flex",
        altText: "New booking received",
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("Booking received"),
                    {
                        type: "text",
                        text: `Dear ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: "Your booking has been added to our system.",
                        size: "sm",
                        color: COLORS.muted,
                        wrap: true
                    },
                    createFlexInfoCard([
                        summaryRow("Service", serviceName),
                        summaryRow("Date/Time", `${appointmentDate} ${time || ''}`.trim()),
                    ]),
                ]
            }
        }
    };
}

export async function createAppointmentReminderFlexTemplate(bookingData: any) {
    const customerName = getCustomerName(bookingData?.customerInfo);
    return createSimpleNoticeFlex(
        'Appointment reminder',
        `Hello ${customerName}, this is a reminder for your upcoming appointment.`,
        'Appointment reminder'
    );
}

export async function createDailyAppointmentNotificationFlexTemplate(appointmentData: any) {
    const customerName = getCustomerName(appointmentData?.customerInfo);
    return createSimpleNoticeFlex(
        'Daily appointment summary',
        `You have appointment activity today for ${customerName}.`,
        'Daily appointment summary'
    );
}

export async function createCheckInFlexTemplate(appointmentData: any) {
    const { customerInfo, bookingInfo, roomTypeInfo, serviceInfo } = appointmentData || {};
    const customerName = getCustomerName(customerInfo);
    const roomName = roomTypeInfo?.name || serviceInfo?.name || 'Room';
    const roomNumber = bookingInfo?.roomNumber || '-';
    const checkInDate = bookingInfo?.checkInDate || appointmentData?.date || '-';
    const checkOutDate = bookingInfo?.checkOutDate || '-';

    const { profile } = await getShopProfile();
    const storeName = profile?.storeName || 'Our Hotel';
    const contactPhone = profile?.contactPhone || '-';
    const address = profile?.address || '-';

    return {
        type: "flex",
        altText: "Check-in completed",
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("Check-in completed", COLORS.info),
                    {
                        type: "text",
                        text: `Dear ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: "Welcome. Your stay details are listed below.",
                        size: "sm",
                        color: COLORS.muted,
                        wrap: true
                    },
                    createFlexInfoCard([
                        summaryRow("Room type", String(roomName)),
                        summaryRow("Room number", String(roomNumber)),
                        summaryRow("Check-in", String(checkInDate)),
                        summaryRow("Check-out", String(checkOutDate)),
                    ]),
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "xs",
                        paddingAll: FLEX_THEME.sectionPadding,
                        backgroundColor: COLORS.infoSoft,
                        cornerRadius: FLEX_THEME.radius,
                        contents: [
                            { type: "text", text: storeName, size: "sm", weight: "bold", color: COLORS.text, wrap: true },
                            { type: "text", text: `Phone: ${contactPhone}`, size: "sm", color: COLORS.lightText, wrap: true },
                            { type: "text", text: address, size: "sm", color: COLORS.lightText, wrap: true }
                        ]
                    }
                ]
            }
        }
    };
}
