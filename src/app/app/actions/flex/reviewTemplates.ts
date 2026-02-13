"use server";

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

export async function createReviewFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time } = appointmentData || {};
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'Customer';
    const serviceName = formatServiceName(serviceInfo || {});
    const safeId = (id || appointmentId || '').toString();
    const appointmentDate = date ? formatThaiDate(date) : '-';

    return {
        type: "flex",
        altText: `Please review ${serviceName}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("Rate your experience"),
                    {
                        type: "text",
                        text: `Dear ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    {
                        type: "text",
                        text: "Your feedback helps us improve our service.",
                        size: "sm",
                        color: COLORS.muted,
                        wrap: true
                    },
                    createFlexInfoCard([
                        summaryRow("Service", serviceName),
                        summaryRow("Date", `${appointmentDate} ${time || ''}`.trim()),
                    ]),
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "Tap the button below to submit your review.",
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
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    createFlexPrimaryButton(
                        "Write a review",
                        `https://liff.line.me/${process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID}/review/${safeId}`
                    )
                ],
                spacing: "sm",
                paddingAll: FLEX_THEME.footerPadding
            }
        }
    };
}

export async function createReviewThankYouFlexTemplate(reviewData: any) {
    const rating = Number(reviewData?.rating || 0);
    const comment = typeof reviewData?.comment === 'string' ? reviewData.comment : '';
    const pointsAwarded = Number(reviewData?.pointsAwarded || 0);
    const customerDisplayName = reviewData?.customerName || 'Customer';
    const stars = rating > 0 ? '★'.repeat(Math.min(5, rating)) : '';

    if (!rating && !comment) {
        const pointsText = pointsAwarded > 0 ? ` You earned ${pointsAwarded} points.` : '';
        return createSimpleNoticeFlex(
            'Thanks for your review',
            `We appreciate your feedback.${pointsText}`,
            'Thanks for your review'
        );
    }

    return {
        type: "flex",
        altText: `Thanks for your ${rating}/5 review`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader("Thank you for your review"),
                    ...(stars ? [{
                        type: "text",
                        text: stars,
                        size: "md",
                        color: COLORS.primary,
                        align: "center"
                    }] : []),
                    {
                        type: "text",
                        text: `Dear ${customerDisplayName}`,
                        weight: "bold",
                        size: "md",
                        color: COLORS.text
                    },
                    createFlexInfoCard([
                        summaryRow("Rating", `${rating}/5`),
                        ...(pointsAwarded > 0 ? [summaryRow("Points", `${pointsAwarded}`)] : []),
                    ]),
                    ...(comment ? [
                        {
                            type: "text",
                            text: "Comment",
                            size: "sm",
                            color: COLORS.muted
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "text",
                                    text: `"${comment}"`,
                                    size: "sm",
                                    color: COLORS.text,
                                    wrap: true
                                }
                            ],
                            paddingAll: FLEX_THEME.sectionPadding,
                            backgroundColor: COLORS.card,
                            cornerRadius: FLEX_THEME.radius
                        }
                    ] : []),
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "We will continue improving our service for you.",
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
