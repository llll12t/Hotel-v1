"use server";

import { getShopProfile } from '../settingsActions';
import {
    FLEX_THEME,
    createFlexHeader,
    createFlexInfoCard,
    createFlexPrimaryButton,
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

export async function createPaymentFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, paymentInfo, customerInfo, date, time } = appointmentData || {};
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'Customer';
    const totalAmount = paymentInfo?.totalAmount || paymentInfo?.totalPrice || serviceInfo?.price || 0;
    const formattedAmount = new Intl.NumberFormat('th-TH').format(Number(totalAmount) || 0);
    const serviceName = formatServiceName(serviceInfo || {});
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '-';
    const appointmentDate = date ? formatThaiDate(date) : '-';

    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'THB';

    return {
        type: "flex",
        altText: `Payment ${formattedAmount} ${currencySymbol}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("Payment"),
                    {
                        type: "text",
                        text: `Dear ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: "Please complete your payment for this booking.",
                        size: "sm",
                        color: COLORS.muted,
                        wrap: true
                    },
                    createFlexInfoCard([
                        summaryRow("Service", serviceName),
                        summaryRow("Date", `${appointmentDate} ${time || ''}`.trim()),
                        summaryRow("Booking ID", shortId),
                    ]),
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "Amount",
                                weight: "bold",
                                size: "md",
                                color: COLORS.text,
                                flex: 0
                            },
                            {
                                type: "text",
                                text: `${formattedAmount} ${currencySymbol}`,
                                weight: "bold",
                                size: "md",
                                color: COLORS.primary,
                                align: "end"
                            }
                        ],
                        paddingAll: "16px",
                        backgroundColor: COLORS.soft,
                        cornerRadius: FLEX_THEME.radius
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    createFlexPrimaryButton(
                        "Pay now",
                        `https://liff.line.me/${process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID}/payment/${safeId}`
                    )
                ],
                spacing: "sm",
                paddingAll: FLEX_THEME.footerPadding
            }
        }
    };
}

export async function createPaymentConfirmationFlexTemplate(appointmentData: any) {
    const totalAmount = appointmentData?.paymentInfo?.amountPaid || appointmentData?.paymentInfo?.totalPrice || 0;
    const amountText = new Intl.NumberFormat('th-TH').format(Number(totalAmount) || 0);
    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'THB';

    return createSimpleNoticeFlex(
        'Payment confirmed',
        `We have received your payment: ${amountText} ${currencySymbol}.`,
        'Payment confirmed',
        COLORS.success
    );
}
