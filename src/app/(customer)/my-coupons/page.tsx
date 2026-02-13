"use client";

import { useState, useEffect } from 'react';
import { useProfile } from '@/context/ProfileProvider';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useLiffContext } from '@/context/LiffProvider';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';
import Link from 'next/link';

// Icons
const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5Z" />
        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
    </svg>
);

const GiftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H4.5a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125H3.375Z" />
    </svg>
);

const CutleryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
        <path fillRule="evenodd" d="M10.5 4.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-1.5 0V5.25a.75.75 0 0 1 .75-.75ZM7.828 3.53a.75.75 0 0 0-1.06-1.06l-4.5 4.5a.75.75 0 0 0 0 1.06l4.5 4.5a.75.75 0 0 0 1.06-1.06L4.56 8.25h14.69a.75.75 0 0 0 0-1.5H4.56l3.268-3.22Z" clipRule="evenodd" />
        {/* Simplified cutlery representation */}
        <path d="M18.75 3a.75.75 0 0 0-1.5 0v4.5h-1.5v-4.5a.75.75 0 0 0-1.5 0v5.25c0 1.6 1.056 2.96 2.443 3.393.208 3.657.207 7.7.207 7.827a.75.75 0 0 0 1.5 0c0-.525 0-4.524-.22-8.083A3.753 3.753 0 0 0 20.25 8.25V3Z" />
    </svg>
);

interface Coupon {
    id: string;
    name: string;
    description?: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    redeemedAt?: any; // Firestore Timestamp
    used?: boolean;
    usedAt?: any;
    appointmentId?: string;
}

const CouponCard = ({ coupon }: { coupon: Coupon }) => {
    const isUsed = coupon.used;
    const redeemedDate = coupon.redeemedAt && typeof coupon.redeemedAt.toDate === 'function'
        ? coupon.redeemedAt.toDate()
        : new Date();

    return (
        <div className={`relative overflow-hidden rounded-2xl p-4 mb-3 transition-all ${isUsed ? 'bg-gray-50 border border-gray-100' : 'bg-gradient-to-br from-black to-gray-800 text-white shadow-lg'}`}>
            {isUsed && <div className="absolute inset-0 bg-white/40 z-10"></div>}
            <div className="relative z-20">
                <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold text-base ${isUsed ? 'text-gray-400' : 'text-white'}`}>{coupon.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isUsed ? 'bg-gray-200 text-gray-400' : 'bg-white/20 text-white backdrop-blur-sm border border-white/10'}`}>
                        {isUsed ? 'ใช้แล้ว' : 'Active'}
                    </span>
                </div>
                <p className={`text-xs ${isUsed ? 'text-gray-400' : 'text-white/80'} mb-3`}>{coupon.description}</p>

                <div className={`border-t border-dashed my-3 ${isUsed ? 'border-gray-200' : 'border-white/10'}`}></div>

                <div className="flex justify-between items-center">
                    <span className={`text-[10px] ${isUsed ? 'text-gray-400' : 'text-white/60'}`}>
                        แลกเมื่อ: {redeemedDate ? format(redeemedDate, 'dd MMM yyyy', { locale: th }) : '-'}
                    </span>
                    {!isUsed && (
                        <span className="text-sm font-bold text-emerald-400">
                            {coupon.discountType === 'percentage' ? `-${coupon.discountValue}%` : `-${coupon.discountValue}฿`}
                        </span>
                    )}
                </div>
            </div>
            {/* Decoration Circles for Ticket Look */}
            <div className={`absolute -left-2 top-1/2 w-4 h-4 rounded-full transform -translate-y-1/2 ${isUsed ? 'bg-white border-r border-gray-100' : 'bg-white'}`}></div>
            <div className={`absolute -right-2 top-1/2 w-4 h-4 rounded-full transform -translate-y-1/2 ${isUsed ? 'bg-white border-l border-gray-100' : 'bg-white'}`}></div>
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <SpaFlowerIcon className="w-16 h-16 animate-spin text-gray-900" style={{ animationDuration: '3s' }} />
            </div>
        );
    }

    // Header Background Image (Same as Appointment Page)
    const headerBgUrl = storeProfile?.headerImage || "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&q=80&w=2070";

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-[#1A1A1A]">

            {/* --- Custom Header --- */}
            <div className="relative h-[200px] w-full overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${headerBgUrl})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/60"></div>
                </div>

                <div className="relative z-10 px-5 pt-8 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white/90 shadow-lg">
                            {profile?.pictureUrl ? (
                                <img src={profile.pictureUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                                    <span className="text-white text-[10px]">User</span>
                                </div>
                            )}
                        </div>
                        <div className="text-white">
                            <p className="text-[11px] text-white/80 font-medium tracking-wide">Goodmorning</p>
                            <h1 className="text-lg font-bold leading-none tracking-tight mt-0.5">{profile?.displayName || 'Guest'}</h1>
                        </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl flex flex-col items-center justify-center shadow-lg min-w-[80px]">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Status</span>
                        <span className="text-xs font-bold text-emerald-600">VIP Member</span>
                    </div>
                </div>
            </div>

            {/* --- Main Content Sheet --- */}
            <div className="bg-white rounded-t-[32px] -mt-12 relative z-20 min-h-[calc(100vh-160px)] pb-24 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">

                {/* Tabs */}
                <div className="px-5 pt-6 pb-2 flex gap-3">
                    <Link href="/my-appointments" className="flex-1">
                        <div className="bg-white border border-gray-100/50 text-gray-500 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all font-bold text-[13px] tracking-wide shadow-sm ring-1 ring-gray-100">
                            <CalendarIcon />
                            <span>การนัดหมาย</span>
                        </div>
                    </Link>

                    <button className="flex-1 bg-black text-white py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-gray-900 transition-all font-bold text-[13px] tracking-wide">
                        <GiftIcon />
                        <span>คูปอง</span>
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 pt-4 pb-20">
                    {/* Redeem Button */}
                    <div className="w-full mb-6">
                        <button
                            className="w-full bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-200 text-gray-500 font-bold py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 group"
                            onClick={() => router.push('/rewards')}
                        >
                            <span className="group-hover:text-black transition-colors">แลกคูปองเพิ่ม</span>
                            <div className="bg-black text-white rounded-full p-0.5 transition-transform group-hover:rotate-90">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                        </button>
                    </div>

                    <div className="w-full space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <SpaFlowerIcon className="w-8 h-8 animate-spin text-gray-300" style={{ animationDuration: '3s' }} />
                                <div className="text-center text-gray-400 pt-3 text-xs">กำลังโหลด...</div>
                            </div>
                        ) : coupons.length === 0 ? (
                            <div className="text-center py-10">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                    <GiftIcon />
                                </div>
                                <p className="font-bold text-gray-900 mb-1 text-sm">ยังไม่มีคูปอง</p>
                                <p className="text-xs text-gray-500 mb-4 px-8">สะสมแต้มจากการใช้บริการ แล้วนำมาแลกคูปองส่วนลดได้เลย!</p>
                            </div>
                        ) : (
                            <>
                                {availableCoupons.length > 0 && (
                                    <div className="animate-fade-in-up">
                                        <h2 className="font-bold text-gray-900 mb-3 text-xs uppercase tracking-wider pl-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            คูปองที่ใช้ได้ ({availableCoupons.length})
                                        </h2>
                                        <div className="space-y-3">
                                            {availableCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                        </div>
                                    </div>
                                )}
                                {usedCoupons.length > 0 && (
                                    <div className="mt-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                        <h2 className="font-bold text-gray-400 mb-3 text-xs uppercase tracking-wider pl-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                            ประวัติคูปอง
                                        </h2>
                                        <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity duration-300">
                                            {usedCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
