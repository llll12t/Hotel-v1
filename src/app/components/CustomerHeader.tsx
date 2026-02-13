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
                <div className="w-12 h-12 rounded-xl bg-gray-200 animate-pulse"></div>
                <div className="flex flex-col items-center gap-1">
                    <div className="h-5 w-24 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-3 w-16 bg-gray-200 animate-pulse rounded"></div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gray-200 animate-pulse"></div>
            </div>
        );
    }

    return (

        <div className="p-4 bg-[#f5f5f5]">
            <header className="flex justify-between items-center">
                {/* Left Group: Profile + Branding */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/(customer)/profile')}
                        className="w-12 h-12 rounded-xl overflow-hidden border border-white  flex items-center justify-center bg-gray-200 transition-all active:scale-95"
                    >
                        {profile?.pictureUrl ? (
                            <img src={profile.pictureUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.68Z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                    </button>
                    <div className="flex flex-col justify-center">
                        <h1 className="text-lg font-bold text-gray-900 leading-tight">3RN Studio</h1>
                        <span className="text-sm text-gray-500 font-medium">Hotel & Resterong</span>
                    </div>
                </div>

                {/* Right Button: Gift */}
                <button
                    onClick={() => router.push('/my-coupons')}
                    className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-gray-900  hover:shadow-md transition-all active:scale-95"
                    aria-label="Gift"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H4.5a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125H3.375Z" />
                    </svg>
                </button>
            </header>
        </div>
    );

}
