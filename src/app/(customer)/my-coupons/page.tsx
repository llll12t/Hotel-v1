"use client";

import { useState, useEffect } from 'react';
import { useProfile } from '@/context/ProfileProvider';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useLiffContext } from '@/context/LiffProvider';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import LoadingIcon from '@/app/components/common/LoadingIcon';
import Link from 'next/link';

// ---- Icons ----
const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
    </svg>
);

const GiftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H4.5a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125H3.375Z" />
    </svg>
);

interface Coupon {
    id: string;
    name: string;
    description?: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    redeemedAt?: any;
    used?: boolean;
    usedAt?: any;
    appointmentId?: string;
}

const CouponCard = ({ coupon }: { coupon: Coupon }) => {
    const isUsed = coupon.used;
    const redeemedDate = coupon.redeemedAt && typeof coupon.redeemedAt.toDate === 'function'
        ? coupon.redeemedAt.toDate()
        : null;

    return (
        <div className={`relative overflow-hidden rounded-2xl mb-3 transition-all ${isUsed
            ? 'bg-gray-50 border border-gray-100'
            : 'bg-gradient-to-br from-[#1A1A1A] to-gray-700 text-white shadow-lg'
            }`}>
            {/* Dashed divider stripe */}
            <div className={`absolute top-1/2 left-0 right-0 border-t border-dashed -translate-y-1/2 ${isUsed ? 'border-gray-200' : 'border-white/10'}`} />

            {/* Notch circles on sides */}
            <div className={`absolute left-0 top-1/2 w-5 h-5 rounded-full -translate-x-1/2 -translate-y-1/2 ${isUsed ? 'bg-white border border-gray-100' : 'bg-gray-100'}`} />
            <div className={`absolute right-0 top-1/2 w-5 h-5 rounded-full translate-x-1/2 -translate-y-1/2 ${isUsed ? 'bg-white border border-gray-100' : 'bg-gray-100'}`} />

            <div className="relative z-10 px-5 py-4">
                {/* Top section */}
                <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 pr-3">
                        <h3 className={`font-bold text-base leading-tight ${isUsed ? 'text-gray-400' : 'text-white'}`}>
                            {coupon.name}
                        </h3>
                        {coupon.description && (
                            <p className={`text-xs mt-0.5 ${isUsed ? 'text-gray-400' : 'text-white/70'}`}>
                                {coupon.description}
                            </p>
                        )}
                    </div>
                    <div className="flex-shrink-0">
                        <span className={`text-lg font-black ${isUsed ? 'text-gray-300' : 'text-white'}`}>
                            {coupon.discountType === 'percentage'
                                ? `-${coupon.discountValue}%`
                                : `-${coupon.discountValue}฿`}
                        </span>
                    </div>
                </div>

                {/* Spacer for dashed divider */}
                <div className="h-4" />

                {/* Bottom section */}
                <div className="flex justify-between items-center">
                    <span className={`text-[10px] ${isUsed ? 'text-gray-400' : 'text-white/50'}`}>
                        {redeemedDate ? `แลกเมื่อ ${format(redeemedDate, 'dd MMM yyyy', { locale: th })}` : ''}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${isUsed
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-white/20 text-white border border-white/10'
                        }`}>
                        {isUsed ? 'ใช้แล้ว' : 'Active'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default function MyCouponsPage() {
    const { profile, loading: liffLoading } = useLiffContext();
    const { profile: storeProfile } = useProfile();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!liffLoading && profile?.userId) {
            const couponsRef = collection(db, 'customers', profile.userId, 'coupons');
            const q = query(couponsRef, orderBy('redeemedAt', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const couponsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
                setCoupons(couponsData);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching coupons:", error);
                setLoading(false);
            });
            return () => unsubscribe();
        } else if (!liffLoading) {
            setLoading(false);
        }
    }, [profile, liffLoading]);

    const availableCoupons = coupons.filter(c => !c.used);
    const usedCoupons = coupons.filter(c => c.used).slice(0, 5);

    if (liffLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <LoadingIcon className="w-12 h-12 text-gray-300" />
            </div>
        );
    }

    const headerBgUrl = storeProfile?.headerImage;

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-[#1A1A1A]">

            {/* ── Header ── */}
            <div className="relative h-[165px] w-full overflow-hidden">
                {headerBgUrl ? (
                    <>
                        <div
                            className="absolute inset-0 bg-cover bg-center scale-105"
                            style={{ backgroundImage: `url(${headerBgUrl})` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/55 to-black/30" />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                )}

                <div className="relative z-10 h-full flex items-center justify-between px-6 pb-4">
                    {/* Left: greeting + name */}
                    <div className="text-white">
                        <p className="text-[11px] text-white/70 font-medium tracking-wide mb-0.5">Goodmorning</p>
                        <h1 className="text-xl font-bold leading-none tracking-tight">{profile?.displayName || 'Guest'}</h1>
                    </div>
                    {/* Right: Avatar */}
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/80 shadow-xl flex-shrink-0">
                        {profile?.pictureUrl ? (
                            <img src={profile.pictureUrl} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-white/20 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">U</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── White Card Sheet ── */}
            <div className="bg-white rounded-[28px] -mt-8 relative z-20 min-h-[calc(100vh-130px)] mx-3 pb-20 shadow-sm">

                {/* Tab Bar */}
                <div className="px-4 pt-5 pb-4 flex gap-2.5">
                    {/* Inactive tab */}
                    <Link href="/my-appointments" className="flex-1">
                        <div className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-500 py-3.5 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-all">
                            <CalendarIcon />
                            <span>การนัดหมาย</span>
                        </div>
                    </Link>

                    {/* Active tab */}
                    <button className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] text-white py-3.5 rounded-2xl font-bold text-sm shadow-md">
                        <GiftIcon />
                        <span>คูปอง</span>
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 pt-2">

                    {/* Redeem Button */}
                    <button
                        className="w-full mb-5 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-200 text-gray-500 font-bold py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 group"
                        onClick={() => router.push('/rewards')}
                    >
                        <span className="group-hover:text-black transition-colors">แลกคูปองเพิ่ม</span>
                        <div className="bg-black text-white rounded-full p-0.5 transition-transform group-hover:rotate-90">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                    </button>

                    {/* Coupon List */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-14">
                            <LoadingIcon className="w-10 h-10 text-gray-300" />
                        </div>
                    ) : coupons.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <GiftIcon />
                            </div>
                            <p className="font-bold text-gray-900 mb-1">ยังไม่มีคูปอง</p>
                            <p className="text-xs text-gray-500 leading-relaxed">สะสมแต้มจากการใช้บริการ แล้วนำมาแลกคูปองส่วนลดได้เลย!</p>
                        </div>
                    ) : (
                        <>
                            {availableCoupons.length > 0 && (
                                <div className="mb-6">
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                                        คูปองที่ใช้ได้ ({availableCoupons.length})
                                    </p>
                                    <div className="space-y-0">
                                        {availableCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                    </div>
                                </div>
                            )}
                            {usedCoupons.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                                        ประวัติคูปอง
                                    </p>
                                    <div className="space-y-0 opacity-60">
                                        {usedCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
