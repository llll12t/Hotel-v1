import { getShopProfile } from '../settingsActions';

export interface FlexServiceInfo {
    name?: string;
    selectedArea?: { name: string; price?: number };
    selectedPackage?: { name: string; duration?: number; price?: number };
}

export const FLEX_THEME = {
    colors: {
        primary: '#553734',
        text: '#333333',
        muted: '#666666',
        card: '#F8F8F8',
        soft: '#F5F2ED',
        success: '#2E7D32',
        successSoft: '#E8F5E9',
        danger: '#D32F2F',
        dangerSoft: '#FFEBEE',
        info: '#2563EB',
        infoSoft: '#EEF2FF',
        lightText: '#374151',
    },
    radius: '10px',
    bodyPadding: '20px',
    sectionPadding: '12px',
    bodySpacing: 'md',
    footerPadding: '20px',
} as const;

export function formatServiceName(serviceInfo: FlexServiceInfo): string {
    let serviceName = serviceInfo?.name || 'Service';

    if (serviceInfo?.selectedArea && serviceInfo?.selectedPackage) {
        serviceName = `${serviceName}\nArea: ${serviceInfo.selectedArea.name}\nDuration: ${serviceInfo.selectedPackage.duration} min`;
    }

    return serviceName;
}

export async function getCurrencySymbol(): Promise<string> {
    const { profile } = await getShopProfile();
    return profile?.currencySymbol || 'THB';
}

export function formatThaiDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

export function createFlexHeader(title: string, color: string = FLEX_THEME.colors.primary) {
    return [
        {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'md',
            color,
            align: 'center',
            margin: 'none',
        },
        {
            type: 'separator',
            margin: 'md',
            color,
        },
    ];
}

export function createFlexInfoCard(contents: any[], backgroundColor: string = FLEX_THEME.colors.card) {
    return {
        type: 'box',
        layout: 'vertical',
        contents,
        spacing: 'sm',
        margin: 'md',
        paddingAll: FLEX_THEME.sectionPadding,
        backgroundColor,
        cornerRadius: FLEX_THEME.radius,
    };
}

export function createFlexPrimaryButton(label: string, uri: string) {
    return {
        type: 'button',
        style: 'primary',
        height: 'sm',
        action: {
            type: 'uri',
            label,
            uri,
        },
        color: FLEX_THEME.colors.primary,
    };
}

export function createSimpleNoticeFlex(title: string, message: string, altText: string, titleColor: string = FLEX_THEME.colors.primary) {
    return {
        type: 'flex',
        altText,
        contents: {
            type: 'bubble',
            size: 'mega',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: FLEX_THEME.bodySpacing,
                paddingAll: FLEX_THEME.bodyPadding,
                contents: [
                    ...createFlexHeader(title, titleColor),
                    {
                        type: 'text',
                        text: message,
                        size: 'sm',
                        color: FLEX_THEME.colors.muted,
                        wrap: true,
                    },
                ],
            },
        },
    };
}
