"use client";

import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CustomerHeaderProps {
    showBackButton?: boolean;
    showActionButtons?: boolean;
    title?: string;
}

export default function CustomerHeader({ showBackButton = false, showActionButtons = true, title }: CustomerHeaderProps) {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
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

    if (liffLoading) return <div className="p-6 bg-[var(--background)] animate-pulse h-32"></div>;

    if (liffError) return null;

    return (
        <div className="pt-6 pb-6 px-6 bg-[var(--background)]">
            {title && (
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => router.back()} className="text-[var(--text-muted)] p-1 -ml-1 hover:text-[var(--text)] transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold text-[var(--text)]">{title}</h1>
                </div>
            )}

            <header className="rounded-md relative overflow-hidden shadow-lg bg-[#2a2a2e]">
                <div className="px-5 flex justify-between items-stretch min-h-[76px]">
                    <div className="flex items-center gap-3 z-10 py-3">

                        {profile?.pictureUrl ? (
                            <div className="w-11 h-11 rounded-xl bg-gray-200 overflow-hidden ring-2 ring-[#3b82f6] flex-shrink-0">
                                <img src={profile.pictureUrl} alt="Profile" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-11 h-11 rounded-xl bg-gray-300 ring-2 ring-[#3b82f6] flex-shrink-0"></div>
                        )}
                        <div className="leading-tight">
                            <p className="text-gray-300 text-[12px] font-medium">Good morning</p>
                            <p className="text-white text-sm font-semibold truncate max-w-[150px]">
                                {profile?.displayName || 'ผู้ใช้ทั่วไป'}
                            </p>
                            {dbError && (
                                <p className="text-[10px] text-[#ffb4a8] bg-[#ffb4a8]/10 px-1 rounded mt-1 inline-block">
                                    {dbError}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push('/my-coupons')}
                        className="bg-[#ff7a3d] text-white pl-7 pr-5 -mr-5 flex flex-col items-end justify-center min-w-[110px] rounded-l-[0px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        style={{ clipPath: 'polygon(22% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
                        aria-label="แลกคูปองด้วยแต้ม"
                        title="แลกคูปองด้วยแต้ม"
                    >
                        <span className="text-[10px] opacity-90 font-medium">Points</span>
                        <span className="text-base font-bold leading-tight">{customerData?.points?.toLocaleString() || 0}</span>
                    </button>
                </div>
            </header>
            
        </div>
    );
}
