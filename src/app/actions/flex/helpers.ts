

import { getShopProfile } from '../settingsActions';

/**
 * ServiceInfo snapshot type for flex templates
 */
export interface FlexServiceInfo {
    name?: string;
    selectedArea?: { name: string; price?: number };
    selectedPackage?: { name: string; duration?: number; price?: number };
}

/**
 * Helper function to format service name with multi-area package info
 */
export function formatServiceName(serviceInfo: FlexServiceInfo): string {
    let serviceName = serviceInfo?.name || 'บริการของคุณ';

    if (serviceInfo?.selectedArea && serviceInfo?.selectedPackage) {
        serviceName = `${serviceName}\n📍 ${serviceInfo.selectedArea.name}\n📦 ${serviceInfo.selectedPackage.duration} นาที`;
    }

    return serviceName;
}

/**
 * Get currency symbol from shop profile
 */
export async function getCurrencySymbol(): Promise<string> {
    const { profile } = await getShopProfile();
    return profile?.currencySymbol || 'บาท';
}

/**
 * Format date to Thai locale
 */
export function formatThaiDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}
