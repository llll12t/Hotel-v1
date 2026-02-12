"use server";

import { getShopProfile } from '../settingsActions';
import {
    FLEX_THEME,
    createFlexHeader,
    createFlexInfoCard,
    createFlexPrimaryButton,
    formatServiceName,
    formatThaiDate,
} from './helpers';

const COLORS = FLEX_THEME.colors;

const formatPaymentMethodThai = (method: any) => {
    const value = String(method || '').toLowerCase().trim();
    if (!value) return '-';
    if (value === 'promptpay') return 'พร้อมเพย์';
    if (value === 'bank' || value === 'bank_transfer' || value === 'transfer') return 'โอนผ่านธนาคาร';
    if (value === 'cash') return 'เงินสด';
    if (value === 'card' || value === 'credit_card') return 'บัตร';
    if (value === 'qr' || value === 'qrcode') return 'QR Code';
    return String(method);
};

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
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const totalAmount = paymentInfo?.totalAmount || paymentInfo?.totalPrice || serviceInfo?.price || 0;
    const formattedAmount = new Intl.NumberFormat('th-TH').format(Number(totalAmount) || 0);
    const serviceName = formatServiceName(serviceInfo || {});
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '-';
    const appointmentDate = date ? formatThaiDate(date) : '-';

    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';

    return {
        type: "flex",
        altText: `แจ้งชำระเงิน ${formattedAmount} ${currencySymbol}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("แจ้งชำระเงิน"),
                    {
                        type: "text",
                        text: `เรียน ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: "กรุณาดำเนินการชำระเงินสำหรับรายการจองนี้",
                        size: "sm",
                        color: COLORS.muted,
                        wrap: true
                    },
                    createFlexInfoCard([
                        summaryRow("บริการ", serviceName),
                        summaryRow("วันที่", `${appointmentDate} ${time || ''}`.trim()),
                        summaryRow("รหัสการจอง", shortId),
                    ]),
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "ยอดชำระ",
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
                        "ชำระเงิน",
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
    const { customerInfo, paymentInfo, id, appointmentId, date, time } = appointmentData || {};
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const totalAmount = appointmentData?.paymentInfo?.amountPaid || appointmentData?.paymentInfo?.totalPrice || 0;
    const amountText = new Intl.NumberFormat('th-TH').format(Number(totalAmount) || 0);
    const paymentMethod = formatPaymentMethodThai(paymentInfo?.paymentMethod);
    const paidAtRaw = paymentInfo?.paidAt;
    const paidAtDate = typeof paidAtRaw?.toDate === 'function' ? paidAtRaw.toDate() : (paidAtRaw ? new Date(paidAtRaw) : null);
    const paidAtText = paidAtDate && !Number.isNaN(paidAtDate.getTime())
        ? paidAtDate.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
        : '-';
    const appointmentDate = date ? formatThaiDate(date) : '-';
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '-';
    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';

    return {
        type: "flex",
        altText: `ยืนยันการชำระเงิน ${amountText} ${currencySymbol}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    {
                        type: "text",
                        text: `เรียน ${customerName},`,
                        size: "md",
                        weight: "bold",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: `เราได้รับการชำระเงินจำนวน ${amountText} ${currencySymbol} เรียบร้อยแล้ว`,
                        size: "sm",
                        color: COLORS.muted,
                        wrap: true
                    },
                    createFlexInfoCard([
                        summaryRow("รหัสการจอง", shortId),
                        summaryRow("วันนัดหมาย", `${appointmentDate} ${time || ''}`.trim()),
                        summaryRow("ช่องทางชำระเงิน", paymentMethod),
                        summaryRow("วันที่ชำระเงิน", paidAtText),
                    ]),
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "ยอดที่ได้รับ",
                                size: "sm",
                                color: COLORS.muted,
                                flex: 2
                            },
                            {
                                type: "text",
                                text: `${amountText} ${currencySymbol}`,
                                size: "md",
                                weight: "bold",
                                color: COLORS.primary,
                                flex: 3,
                                align: "end"
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
