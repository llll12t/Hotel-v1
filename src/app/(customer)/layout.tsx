"use client";

import { LiffProvider } from '@/context/LiffProvider';
import { ProfileProvider } from '@/context/ProfileProvider';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
    const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;

    return (
        <LiffProvider liffId={customerLiffId}>
            <ProfileProvider>
                <div className="fixed inset-0 w-full h-[100dvh] bg-gray-100 overflow-hidden flex justify-center">
                    <main className="w-full max-w-md h-full overflow-y-auto overflow-x-hidden relative z-10 custom-scrollbar">
                        {children}
                    </main>
                </div>
            </ProfileProvider>
        </LiffProvider>
    );
}
