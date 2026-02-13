"use client";

import { useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { LiffProvider } from '@/context/LiffProvider';
import { ProfileProvider } from '@/context/ProfileProvider';

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
                <div className="fixed inset-0 w-full h-[100dvh] bg-[var(--background)] overflow-hidden flex justify-center text-[var(--foreground)]">
                    <main className='w-full max-w-md h-full overflow-y-auto overflow-x-hidden relative z-10 custom-scrollbar'>
                        {children}
                    </main>
                </div>
            </ProfileProvider>
        </LiffProvider>
    );
}

