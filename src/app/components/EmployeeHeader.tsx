"use client";

import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function EmployeeHeader({ showBackButton = false }: { showBackButton?: boolean }) {
    const { profile, loading, error } = useLiffContext();
    const router = useRouter();

    if (loading) {
        return (
            <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
                <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                    <div className="flex-1">
                        <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                </div>
            </header>
        );
    }

    if (error) {
        return (
            <header className="bg-red-50 border-b border-red-100 sticky top-0 z-40">
                <div className="max-w-md mx-auto px-4 py-3">
                    <p className="text-red-600 text-sm"><strong>Error:</strong> {error}</p>
                </div>
            </header>
        );
    }

    return (
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
            <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
                {showBackButton && (
                    <button
                        onClick={() => router.back()}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                {profile?.pictureUrl && (
                    <Image
                        src={profile.pictureUrl}
                        width={40}
                        height={40}
                        alt="Profile"
                        className="w-10 h-10 rounded-full ring-2 ring-gray-100"
                        unoptimized
                    />
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">พนักงาน</p>
                    <p className="font-semibold text-gray-800 truncate">{profile?.displayName}</p>
                </div>
            </div>
        </header>
    );
}
