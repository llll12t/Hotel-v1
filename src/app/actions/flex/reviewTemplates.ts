"use server";
import { getShopProfile } from '../settingsActions';
import { formatServiceName } from './helpers';
export async function createReviewFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || appointmentId || '').toString();
    const appointmentDate = new Date(date).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    return {
        type: "flex",
        altText: `ให้คะแนนรีวิว ${serviceName}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "ให้คะแนนรีวิว",
                        weight: "bold",
                        size: "md",
                        color: "#553734",
                        align: "center",
                        margin: "none"
                    },
                    {
                        type: "separator",
                        margin: "md",
                        color: "#553734"
                    },
                    {
                        type: "text",
                        text: `เรียน ${customerName}`,
                        weight: "bold",
                        size: "md",
                        color: "#333333",
                        margin: "md"
                    },
                    {
                        type: "text",
                        text: "ช่วยรีวิวบริการของเรา",
                        size: "md",
                        color: "#553734",
                        weight: "bold",
                        margin: "sm"
                    },
                    {
                        type: "text",
                        text: "เพื่อช่วยให้เราปรับปรุงบริการให้ดียิ่งขึ้น",
                        size: "sm",
                        color: "#666666",
                        wrap: true,
                        margin: "sm"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "บริการ",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: serviceName,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 3,
                                        wrap: true,
                                        align: "end"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "วันที่",
                                        size: "sm",
                                        color: "#666666",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: `${appointmentDate}`,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 2,
                                        align: "end"
                                    },
                                    {
                                        type: "text",
                                        text: time,
                                        size: "sm",
                                        color: "#333333",
                                        flex: 1,
                                        align: "end"
                                    }
                                ]
                            }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "กดปุ่มด้านล่างเพื่อให้คะแนนและแสดงความคิดเห็น",
                                size: "sm",
                                color: "#553734",
                                wrap: true,
                                align: "center"
                            }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "ให้คะแนน",
                            uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID}/review/${safeId}`
                        },
                        color: "#553734"
                    }
                ],
                spacing: "sm",
                paddingAll: "20px"
            }
        }
    };
}

export async function createReviewThankYouFlexTemplate(reviewData: any) {
    const { rating, comment, customerName } = reviewData;
    const stars = '⭐'.repeat(rating);
    const customerDisplayName = customerName || 'คุณลูกค้า';

    return {
        type: "flex",
        altText: `🎉 ขอบคุณสำหรับรีวิว ${rating} ดาว`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "ขอบคุณสำหรับรีวิว!",
                        weight: "bold",
                        size: "md",
                        color: "#553734",
                        align: "center",
                        margin: "none"
                    },
                    {
                        type: "text",
                        text: stars,
                        size: "md",
                        color: "#553734",
                        align: "center",
                        margin: "sm"
                    },
                    {
                        type: "separator",
                        margin: "md",
                        color: "#553734"
                    },
                    {
                        type: "text",
                        text: `เรียน ${customerDisplayName}`,
                        weight: "bold",
                        size: "md",
                        color: "#333333",
                        margin: "md"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "คะแนนที่ให้",
                                size: "md",
                                color: "#666666",
                                flex: 0
                            },
                            {
                                type: "text",
                                text: `${rating}/5 ดาว`,
                                weight: "bold",
                                size: "md",
                                color: "#553734",
                                align: "end"
                            }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    ...(comment ? [
                        {
                            type: "text",
                            text: "ความคิดเห็น",
                            size: "sm",
                            color: "#666666",
                            margin: "md"
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "text",
                                    text: `"${comment}"`,
                                    size: "md",
                                    color: "#333333",
                                    wrap: true,
                                    style: "italic"
                                }
                            ],
                            margin: "sm",
                            paddingAll: "12px",
                            backgroundColor: "#F8F8F8",
                            cornerRadius: "8px"
                        }
                    ] : []),
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "ความคิดเห็นของคุณมีค่ามากสำหรับเรา เราจะนำไปปรับปรุงบริการต่อไป",
                                size: "sm",
                                color: "#553734",
                                wrap: true,
                                align: "center"
                            }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}
