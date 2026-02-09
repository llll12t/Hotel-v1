"use client";

import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/context/ProfileProvider';

const CoinIcon = ({ className = "w-6 h-6", ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        {...props}
    >
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
);

interface CustomerHeaderProps {
    showBackButton?: boolean;
    showActionButtons?: boolean;
    title?: string; // Add optional title prop
}

export default function CustomerHeader({ showBackButton = false, showActionButtons = true, title }: CustomerHeaderProps) {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const { profile: shopProfile } = useProfile();
    const [customerData, setCustomerData] = useState<any>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        let unsubscribe = () => { };

        if (!liffLoading && profile?.userId) {
            const customerRef = doc(db, "customers", profile.userId);

            unsubscribe = onSnapshot(customerRef, (doc) => {
                if (doc.exists()) {
                    setCustomerData(doc.data());
                    setDbError(null);
                } else {
                    console.warn("ไม่พบข้อมูลลูกค้าใน Database (อาจเป็นลูกค้าใหม่)");
                    setCustomerData({ points: 0 });
                }
            }, (error) => {
                console.error("Firebase Error:", error);
                setDbError("เชื่อมต่อข้อมูลไม่สำเร็จ");
            });
        }
        return () => unsubscribe();
    }, [profile, liffLoading]);

    if (liffLoading) return <div className="p-6 bg-gray-50 animate-pulse h-32"></div>;

    if (liffError) return null; // Or show error message

    return (
        <div className="pt-6 pb-6 px-6">
            {title && (
                <div className="flex items-center gap-2 mb-4">
                    {showBackButton && (
                        <button onClick={() => router.back()} className="text-gray-600 p-1 -ml-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                    )}
                    <h1 className="text-xl font-bold text-gray-800">{title}</h1>
                </div>
            )}

            <header className="flex items-center justify-between">
                {/* ส่วนโปรไฟล์ซ้ายมือ */}
                <div className="flex items-center gap-3">
                    {!title && showBackButton && (
                        <button onClick={() => router.back()} className="text-gray-600 p-1 -ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                    )}
                    {profile?.pictureUrl ? (
                        <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border border-gray-300 shadow-sm z-10 bg-white relative">
                            {/* Note: In Next.js, Image requires width/height or fill. But remote images need domain config. 
                                 For now, assume domains are configured or use unoptimized if issues arise. 
                                 Or use standard img tag for simplicity if domain config is not accessible. 
                                 Using standard img for safety in this environment without config access. */}
                            <img src={profile.pictureUrl} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 border border-gray-300 shadow-sm z-10" />
                    )}
                    <div>
                        <p className="font-bold text-gray-900 text-lg line-clamp-1">
                            {profile?.displayName || 'ผู้ใช้'}
                        </p>
                        <p className="text-xs text-gray-500"> {shopProfile?.storeName || 'SPA & MASSAGE'} ยินดีต้อนรับ</p>
                        {dbError && <p className="text-xs text-red-600 bg-red-50 px-1 rounded mt-1">{dbError}</p>}
                    </div>
                </div>

                {/* ส่วนแสดงแต้มสะสม */}
                <div className="flex flex-col items-end gap-1">
                    <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-sm">
                        <div className="bg-white rounded-full p-1 border border-gray-200 shadow-sm">
                            <CoinIcon className="w-4 h-4 text-yellow-500" />
                        </div>
                        <span className="text-base font-bold text-gray-800 leading-none">
                            {customerData?.points ?? 0} <span className="text-xs font-normal text-gray-500">แต้ม</span>
                        </span>
                    </div>
                </div>
            </header>



            {showActionButtons && (
                <div className="mt-5 grid grid-cols-2 gap-3 relative z-10">
                    <button
                        onClick={() => router.push('/appointment')}
                        className="bg-primary text-white rounded-2xl py-3 font-medium text-base hover:bg-primary-light transition-all border border-transparent shadow-sm flex items-center justify-center gap-2 shadow-[#5D4037]/20"
                    >
                        <span>จองบริการ</span>
                    </button>
                    <button
                        onClick={() => router.push('/my-coupons')}
                        className="bg-white text-gray-800 rounded-2xl py-3 font-medium text-base hover:bg-gray-50 transition-all border border-gray-300 shadow-sm"
                    >
                        คูปองของฉัน
                    </button>
                </div>
            )}
        </div>
    );
}
