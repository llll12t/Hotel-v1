"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useLiffContext } from '@/context/LiffProvider';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Link from 'next/link';
import CustomerHeader from '@/app/components/CustomerHeader';

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
        <div className={`relative overflow-hidden rounded-2xl p-4 mb-2 transition-all ${isUsed ? 'bg-gray-50 border border-gray-200' : 'bg-[#5D4037] text-white shadow-md'}`}>
            {isUsed && <div className="absolute inset-0 bg-white/60 z-10"></div>}
            <div className="relative z-20">
                <div className="flex justify-between items-center mb-1">
                    <h3 className={`font-bold text-base ${isUsed ? 'text-gray-500' : 'text-white'}`}>{coupon.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isUsed ? 'bg-gray-200 text-gray-500' : 'bg-white/20 text-white backdrop-blur-sm border border-white/10'}`}>{isUsed ? 'ใช้แล้ว' : 'ใช้ได้'}</span>
                </div>
                <p className={`text-xs ${isUsed ? 'text-gray-400' : 'text-white/90'}`}>{coupon.description}</p>
                <div className={`border-t border-dashed my-3 ${isUsed ? 'border-gray-300' : 'border-white/20'}`}></div>
                <div className="flex justify-between items-center">
                    <span className={`text-xs ${isUsed ? 'text-gray-400' : 'text-white/80'}`}>
                        แลกเมื่อ: {redeemedDate ? format(redeemedDate, 'dd MMM yyyy', { locale: th }) : '-'}
                    </span>
                    {!isUsed && (
                        <span className="text-xs text-white/80 font-medium">ส่วนลด {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `฿${coupon.discountValue}`}</span>
                    )}
                </div>
            </div>
            {/* Decoration Circles for Ticket Look */}
            <div className={`absolute -left-2 top-1/2 w-4 h-4 rounded-full transform -translate-y-1/2 ${isUsed ? 'bg-white border-r border-gray-200' : 'bg-[#faf9f6]'}`}></div>
            <div className={`absolute -right-2 top-1/2 w-4 h-4 rounded-full transform -translate-y-1/2 ${isUsed ? 'bg-white border-l border-gray-200' : 'bg-[#faf9f6]'}`}></div>
        </div>
    );
};

export default function MyCouponsPage() {
    const { profile, loading: liffLoading } = useLiffContext();
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
    const usedCoupons = coupons.filter(c => c.used).slice(0, 5); // แสดงประวัติแค่ 5 รายการล่าสุด

    return (
        <div>
            <CustomerHeader showBackButton={true} title="คูปองของฉัน" />
            <div className="min-h-screen flex flex-col items-center p-6 bg-[#faf9f6]">
                {/* ปุ่มแลกคูปอง */}
                <div className="w-full flex justify-end mb-4">
                    <button
                        className="bg-[#5D4037] hover:bg-[#3E2723] text-white font-medium py-2 px-4 rounded-xl shadow-sm text-sm transition-all hover:shadow-md flex items-center gap-2"
                        onClick={() => router.push('/rewards')}
                    >
                        <span>แลกคูปองเพิ่ม</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>

                <div className="w-full space-y-4">
                    {loading ? (
                        <div className="text-center text-gray-500 pt-6 text-sm animate-pulse">กำลังโหลดคูปอง...</div>
                    ) : coupons.length === 0 ? (
                        <div className="text-center text-gray-500 pt-10">
                            <div className="bg-white p-6 rounded-2xl shadow-sm max-w-xs mx-auto border border-gray-100">
                                <p className="font-semibold text-gray-800 mb-2">ยังไม่มีคูปอง</p>
                                <p className="text-xs text-gray-500 leading-relaxed mb-4">สะสมแต้มจากการใช้บริการ แล้วนำมาแลกคูปองส่วนลดได้เลย!</p>
                                <button
                                    onClick={() => router.push('/rewards')}
                                    className="text-[#5D4037] text-sm font-semibold underline hover:text-[#3E2723]"
                                >
                                    ไปหน้าแลกของรางวัล
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {availableCoupons.length > 0 && (
                                <div>
                                    <h2 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        คูปองที่ใช้ได้
                                    </h2>
                                    <div className="space-y-3">
                                        {availableCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                    </div>
                                </div>
                            )}
                            {usedCoupons.length > 0 && (
                                <div className="mt-6">
                                    <h2 className="font-bold text-gray-400 mb-3 text-sm flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                        ประวัติคูปอง
                                    </h2>
                                    <div className="space-y-3 opacity-80">
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
