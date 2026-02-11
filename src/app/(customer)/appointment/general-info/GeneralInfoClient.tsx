"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { useProfile } from '@/context/ProfileProvider';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createBooking } from '@/app/actions/appointmentActions';
import { useToast } from '@/app/components/Toast';
import LoadingScreen from '@/app/components/common/LoadingScreen';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

function GeneralInfoContent() {
    const searchParams = useSearchParams();
    const { profile, loading: liffLoading, liff } = useLiffContext();
    const { profile: shopProfile } = useProfile();
    const router = useRouter();
    const { showToast } = useToast();

    // Booking params
    const roomTypeId = searchParams.get('roomTypeId');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const roomsParam = searchParams.get('rooms');
    const nightsParam = searchParams.get('nights');
    const bookingGuestsParam = searchParams.get('guests');

    // Financial params passed from previous step
    const paramTotalPrice = Number(searchParams.get('totalPrice')) || 0;
    const paramOriginalPrice = Number(searchParams.get('originalPrice')) || 0;
    const paramDiscount = Number(searchParams.get('discount')) || 0;
    const paramCouponId = searchParams.get('couponId');

    const [formData, setFormData] = useState({ fullName: "", phone: "", email: "", note: "" });
    const [roomType, setRoomType] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const bookingRooms = roomsParam ? Math.max(1, parseInt(roomsParam) || 1) : 1;
    const bookingNights = nightsParam ? Math.max(1, parseInt(nightsParam) || 1) : 1;
    const bookingGuests = bookingGuestsParam ? parseInt(bookingGuestsParam) : undefined;
    const bookingGuestsSafe = Number.isFinite(bookingGuests) ? bookingGuests : undefined;
    const bookingCurrencySymbol = roomType?.currencySymbol || shopProfile.currencySymbol || '฿';

    // Use passed params or fallback (fallback shouldn't happen in normal flow)
    const bookingTotal = paramOriginalPrice;
    const finalTotal = paramTotalPrice;
    const discountAmount = paramDiscount;

    useEffect(() => {
        const fetchAllData = async () => {
            if (liffLoading) return;
            if (!profile?.userId) {
                setLoading(false);
                return;
            }

            try {
                const customerPromise = getDoc(doc(db, "customers", profile.userId));
                const roomTypePromise = roomTypeId ? getDoc(doc(db, 'roomTypes', roomTypeId)) : Promise.resolve(null);

                const [customerSnap, roomTypeSnap] = await Promise.all([
                    customerPromise,
                    roomTypePromise,
                ]);

                if (customerSnap.exists()) {
                    const data = customerSnap.data();
                    setFormData(prev => ({ ...prev, fullName: data.fullName || profile.displayName || "", phone: data.phone || "", email: data.email || "" }));
                } else {
                    setFormData(prev => ({ ...prev, fullName: profile.displayName || "" }));
                }

                if (roomTypeSnap && roomTypeSnap.exists()) {
                    setRoomType({ id: roomTypeSnap.id, ...roomTypeSnap.data() });
                } else {
                    setRoomType(null);
                }

            } catch (error) {
                console.error("Error fetching details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [liffLoading, profile?.userId, roomTypeId]);

    const formatDate = (value: string | null) => {
        if (!value) return '-';
        const dateValue = new Date(value);
        if (Number.isNaN(dateValue.getTime())) return '-';
        return format(dateValue, 'dd/MM/yyyy', { locale: th });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const fullNameInput = document.querySelector('input[name="fullName"]') as HTMLInputElement;
        const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement;

        if (!formData.fullName || !formData.phone) {
            showToast("กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์", "warning");
            if (!formData.fullName && fullNameInput) fullNameInput.focus();
            else if (!formData.phone && phoneInput) phoneInput.focus();
            return;
        }

        if (liffLoading || !profile?.userId) {
            showToast('กรุณาเข้าสู่ระบบก่อนทำการจอง', "warning");
            return;
        }

        if (!roomTypeId) {
            showToast('ไม่พบข้อมูลห้องพัก', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const bookingData: any = {
                userId: profile.userId,
                roomTypeId,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                nights: bookingNights,
                rooms: bookingRooms,
                guests: bookingGuestsSafe,
                status: 'pending',
                customerInfo: {
                    ...formData,
                    pictureUrl: profile.pictureUrl || ''
                },
                paymentInfo: {
                    originalPrice: bookingTotal,
                    totalPrice: finalTotal, // Use the passed total
                    discount: discountAmount,
                    couponId: paramCouponId || null,
                    couponName: null, // Could fetch if needed, but ID is enough for logic usually. 
                    paymentStatus: 'unpaid'
                }
            };

            const lineAccessToken = liff?.getAccessToken?.();
            const result = await createBooking(bookingData, { lineAccessToken });

            if (!result.success) {
                showToast(typeof result.error === 'string' ? result.error : "เกิดข้อผิดพลาด", "error");
                setIsSubmitting(false);
                return;
            }

            showToast('จองห้องพักสำเร็จ!', "success");
            router.push('/my-appointments');
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง', "error");
            console.error(err);
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <LoadingScreen spinnerStyle={{ animationDuration: '3s' }} />
        );
    }

    if (!roomTypeId) return null;

    return (
        <div>
            <div className="px-6 py-6 pb-20">
                {/* Mini Summary Card */}
                <div className="bg-[var(--card)] rounded-xl p-4 mb-4 shadow-sm border border-[var(--border)] flex justify-between items-center animate-fade-in-up">
                    <div>
                        <h3 className="font-bold text-[var(--text)] text-sm">{roomType?.name}</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            {formatDate(checkIn)} - {formatDate(checkOut)} ({bookingNights} คืน)
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                            {bookingRooms} ห้องพัก, ผู้เข้าพัก {bookingGuestsSafe} ท่าน
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="block text-lg font-bold text-[var(--primary)]">
                            {finalTotal.toLocaleString()} {bookingCurrencySymbol}
                        </span>
                        {discountAmount > 0 && (
                            <span className="text-[10px] text-[var(--success)] block">ส่วนลด -{discountAmount.toLocaleString()}</span>
                        )}
                    </div>
                </div>

                <div className="bg-[var(--card)] text-[var(--text)] rounded-2xl p-6 mb-6 shadow-sm border border-[var(--border)]">
                    <h2 className="text-xl font-bold text-[var(--text)] mb-2">ข้อมูลผู้เข้าพัก</h2>
                    <p className="text-sm text-[var(--text-muted)] mb-6">กรุณากรอกข้อมูลสำหรับการติดต่อ</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">ชื่อ-สกุล</label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--input-bg)] outline-none transition-all placeholder-[var(--placeholder-bg)]"
                                placeholder="กรอกชื่อ-นามสกุล"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">เบอร์ติดต่อ</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--input-bg)] outline-none transition-all placeholder-[var(--placeholder-bg)]"
                                placeholder="กรอกเบอร์โทรศัพท์"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">อีเมล (ถ้ามี)</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--input-bg)] outline-none transition-all placeholder-[var(--placeholder-bg)]"
                                placeholder="กรอกอีเมล"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">ข้อความเพิ่มเติม</label>
                            <textarea
                                name="note"
                                value={formData.note}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-4 py-3 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--input-bg)] resize-none outline-none transition-all placeholder-[var(--placeholder-bg)]"
                                placeholder="เช่น แพ้ยา, ขอหมอนเพิ่ม"
                            />
                        </div>
                    </form>
                </div>

                {/* Confirm Button Fixed Bottom */}
                <div className="fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] p-4 z-50">
                    <div className="max-w-md mx-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white py-3 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 transition-all transform active:scale-95 shadow-[var(--primary)]/20"
                        >
                            {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการจอง'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function GeneralInfoPage() {
    return (
        <Suspense
            fallback={
                <LoadingScreen spinnerStyle={{ animationDuration: '3s' }} />
            }
        >
            <GeneralInfoContent />
        </Suspense>
    );
}
