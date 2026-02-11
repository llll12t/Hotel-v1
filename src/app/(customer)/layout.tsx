"use client";

import { useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { LiffProvider } from '@/context/LiffProvider';
import { ProfileProvider } from '@/context/ProfileProvider';

import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
    const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;

    useEffect(() => {
        const handleVisibilityChange = async () => {
            try {
                if (document.hidden) {
                    await disableNetwork(db);
                } else {
                    await enableNetwork(db);
                }
            } catch (err) {
                console.error("Error toggling network:", err);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return (
        <LiffProvider liffId={customerLiffId}>
            <ProfileProvider>
                <div className="min-h-screen relative overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
                    <div className="fixed top-[-30px] right-[-30px] opacity-[0.06] pointer-events-none z-0">
                        <SpaFlowerIcon className="w-60 h-60 text-[var(--primary)]" />
                    </div>
                    <div className="fixed bottom-[-40px] left-[-40px] opacity-[0.06] pointer-events-none z-0 transform rotate-45">
                        <SpaFlowerIcon className="w-48 h-48 text-[var(--primary)]" />
                    </div>
                    <div className="fixed top-[40%] right-[-20px] opacity-[0.04] pointer-events-none z-0 transform -rotate-12">
                        <SpaFlowerIcon className="w-32 h-32 text-[var(--primary)]" />
                    </div>

                    <main className='w-full max-w-md mx-auto min-h-screen relative z-10'>
                        {children}
                    </main>
                </div>
            </ProfileProvider>
        </LiffProvider>
    );
}

