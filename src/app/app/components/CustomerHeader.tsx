"use client";

import { useLiffContext } from '@/context/LiffProvider';
import { useRouter } from 'next/navigation';

interface CustomerHeaderProps {
    showBackButton?: boolean;
    showActionButtons?: boolean; // Prop kept for compatibility but currently unused in new design
    title?: string; // Optional override for the subtitle or title
}

export default function CustomerHeader({ title }: CustomerHeaderProps) {
    const { profile, loading: liffLoading } = useLiffContext();
    const router = useRouter();

    if (liffLoading) {
        return (
            <div className="pt-6 pb-2 px-6 bg-[var(--background)] flex justify-between items-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-200 animate-pulse"></div>
                <div className="flex flex-col items-center gap-1">
                    <div className="h-5 w-24 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-3 w-16 bg-gray-200 animate-pulse rounded"></div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gray-200 animate-pulse"></div>
            </div>
        );
    }

    return (
        <div className="pt-8 pb-4 px-6 bg-[var(--background)]">
            <header className="flex justify-between items-center">
                {/* Left Button: Profile */}
                <button
                    onClick={() => router.push('/(customer)/profile')}
                    className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm flex items-center justify-center transition-all active:scale-95"
                >
                    {profile?.pictureUrl ? (
                        <img src={profile.pictureUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>

                {/* Center: Branding (Logo Style) */}
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-[var(--text)] tracking-tight">3RN Studio</h1>
                </div>

                {/* Right Button: Coupon */}
                <button
                    onClick={() => router.push('/my-coupons')}
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[var(--text)] shadow-sm hover:shadow-md transition-all active:scale-95"
                    aria-label="Coupons"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v9.632a2.25 2.25 0 0 1-.659 1.591l-1.21 1.21a.75.75 0 0 0-.22.53v2.246c0 .621.504 1.125 1.125 1.125h15.75c.621 0 1.125-.504 1.125-1.125V5.25c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                    </svg>
                </button>
            </header>
        </div>
    );
}
