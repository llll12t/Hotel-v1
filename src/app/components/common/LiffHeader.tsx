"use client";

import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';

interface LiffHeaderProps {
    /** Label text shown above display name (e.g. "ชำระเงิน", "รีวิวบริการ") */
    label: string;
    /** Tailwind gradient classes (e.g. "from-green-400 to-green-600") */
    gradientClass: string;
    /** Tailwind text color class for the label (e.g. "text-green-100") */
    labelColorClass: string;
}

export default function LiffHeader({ label, gradientClass, labelColorClass }: LiffHeaderProps) {
    const { profile, loading, error } = useLiffContext();

    if (loading) {
        return (
            <div className="p-4">
                <div className="bg-white shadow-sm rounded-2xl p-4 flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-gray-300 animate-pulse flex-shrink-0"></div>
                    <div className="flex-grow space-y-2">
                        <div className="h-3 bg-gray-300 rounded w-1/4 animate-pulse"></div>
                        <div className="h-4 bg-gray-300 rounded w-3/4 animate-pulse"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                    <p className="text-yellow-800 text-sm">⚠️ การเชื่อมต่อ LINE ไม่สมบูรณ์</p>
                    <p className="text-yellow-700 text-xs mt-1">สามารถใช้งานได้ แต่บางฟีเจอร์อาจไม่สมบูรณ์</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <header className={`bg-gradient-to-r ${gradientClass} shadow-sm rounded-2xl p-4 flex items-center space-x-4 text-white`}>
                {profile?.pictureUrl ? (
                    <Image
                        src={profile.pictureUrl}
                        width={48}
                        height={48}
                        alt="Profile"
                        className="w-12 h-12 rounded-full border-2 border-white"
                        unoptimized
                    />
                ) : null}
                <div>
                    <p className={`${labelColorClass} text-sm`}>{label}</p>
                    <p className="font-semibold text-base">คุณ{profile?.displayName || 'ลูกค้า'}</p>
                </div>
            </header>
        </div>
    );
}
