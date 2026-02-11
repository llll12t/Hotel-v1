"use client";

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { submitReview } from '@/app/actions/reviewActions';
import { createReviewThankYouFlexTemplate } from '@/app/actions/flexTemplateActions';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Star Rating Component
const StarRating = ({ rating, setRating }: { rating: number, setRating: (val: number) => void }) => {
    return (
        <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`w-10 h-10 sm:w-12 sm:h-12 transition-colors ${rating >= star ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-200'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0L7.07 7.56l-5.056.367c-.83.06-1.171 1.106-.536 
                        1.651l3.847 3.292-1.148 4.873c-.19.806.676 
                        1.44 1.374.995L10 15.347l4.45 2.39c.698.445 
                        1.563-.189 1.374-.995l-1.149-4.873 
                        3.847-3.292c.635-.545.294-1.591-.536-1.651L12.93 
                        7.56l-2.062-4.676z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            ))}
        </div>
    );
};

function ReviewContent() {
    const { liff, profile, loading: liffLoading } = useLiffContext();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [appointment, setAppointment] = useState<any | null>(null);

    const params = useParams();
    const searchParams = useSearchParams();
    const appointmentId = params?.appointmentId as string;

    useEffect(() => {
        // Try to get appointmentId from all possible sources
        let id = appointmentId;
        if (!id) {
            // Try searchParams (query string)
            id = searchParams.get('appointmentId') as string;
        }
        if (!id) {
            // Try liff.state (for LIFF deep link)
            const liffState = searchParams.get('liff.state');
            if (liffState) {
                const parts = liffState.split('/');
                if (parts.length > 2 && parts[1] === 'review') {
                    id = parts[2];
                }
            }
        }
        if (!id && typeof window !== 'undefined') {
            // Try to parse from window.location.pathname (for edge cases)
            const pathParts = window.location.pathname.split('/');
            const idx = pathParts.findIndex(p => p === 'review');
            if (idx !== -1 && pathParts.length > idx + 1) {
                id = pathParts[idx + 1];
            }
        }

        if (id) {
            const fetchAppointment = async () => {
                try {
                    const appointmentRef = doc(db, 'appointments', id);
                    const appointmentSnap = await getDoc(appointmentRef);
                    if (appointmentSnap.exists()) {
                        setAppointment({ id, ...appointmentSnap.data() });
                    } else {
                        setError('ไม่พบข้อมูลการนัดหมาย');
                    }
                } catch (err) {
                    console.error('Error fetching appointment:', err);
                    setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
                }
            };
            fetchAppointment();
        } else if (!liffLoading) {
            setError('ไม่พบ Appointment ID');
        }
    }, [appointmentId, searchParams, liffLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (rating === 0) {
            setError('กรุณาให้คะแนนอย่างน้อย 1 ดาว');
            return;
        }

        if (!profile?.userId || !appointment) {
            setError('ไม่สามารถระบุตัวตนหรือข้อมูลการนัดหมายได้');
            return;
        }

        if (!liff) {
            setError('ไม่สามารถเชื่อมต่อ LINE ได้');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const reviewData = {
                appointmentId: appointment.id,
                userId: profile.userId,
                userName: profile.displayName,
                userPicture: profile.pictureUrl,
                rating,
                comment: comment.trim(),
                serviceId: appointment.serviceId,
                technicianId: appointment.technicianId,
                createdAt: new Date().toISOString()
            };

            const lineAccessToken = liff?.getAccessToken?.();
            const result = await submitReview(reviewData, { lineAccessToken });

            if (result.success) {
                setSuccess(true);

                // ส่งข้อความกลับ LINE OA
                if (liff.isInClient()) {
                    try {
                        // สร้าง Flex Message สำหรับขอบคุณหลังรีวิว
                        const reviewThankYouFlex = await createReviewThankYouFlexTemplate({
                            rating,
                            comment: comment.trim(),
                            appointmentId: appointment.id,
                            customerName: profile.displayName
                        });

                        await liff.sendMessages([reviewThankYouFlex]);
                    } catch (msgError) {
                        console.warn('ไม่สามารถส่งข้อความได้:', msgError);
                    }
                }

                // ปิด LIFF หลังจากสำเร็จ
                setTimeout(() => {
                    if (liff && liff.closeWindow) {
                        liff.closeWindow();
                    }
                }, 3000);
            } else {
                throw new Error(result.error || 'ไม่สามารถส่งรีวิวได้');
            }
        } catch (err: any) {
            console.error('Error submitting review:', err);
            setError(err.message || 'เกิดข้อผิดพลาดในการส่งรีวิว');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        if (liff && liff.closeWindow) {
            liff.closeWindow();
        }
    };

    if (liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAF9F6]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-500 font-light">กำลังโหลด...</p>
            </div>
        );
    }

    if (error && !appointment) {
        return (
            <div className="min-h-screen bg-[#FAF9F6] p-6 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
                    <div className="text-red-500 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>
                    </div>
                    <div className="text-gray-900 text-lg font-semibold mb-2">เกิดข้อผิดพลาด</div>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={handleCancel}
                        className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-2xl hover:bg-gray-200 transition-colors font-medium"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#FAF9F6] p-6 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
                    <div className="text-6xl mb-6">🎉</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">ขอบคุณสำหรับรีวิว!</h2>
                    <div className="text-yellow-400 text-2xl mb-4 flex justify-center space-x-1">
                        {'⭐'.repeat(rating)}
                    </div>
                    <p className="text-gray-600 mb-8 font-light">
                        ความคิดเห็นของคุณมีค่ามากสำหรับเรา
                    </p>
                    <button
                        onClick={handleCancel}
                        className="w-full bg-primary text-white px-6 py-3 rounded-2xl hover:bg-primary-dark transition-colors font-medium shadow-sm hover:shadow"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF9F6] py-8 px-4">
            <div className="max-w-md mx-auto space-y-6">

                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-primary">ให้คะแนนความพึงพอใจ</h1>
                    <p className="text-gray-500 font-light text-sm mt-1">ช่วยบอกเล่าประสบการณ์ของคุณ</p>
                </div>

                {/* Appointment Info */}
                {appointment && (
                    <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-50">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="bg-primary/5 p-2 rounded-xl">
                                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <h3 className="font-semibold text-gray-800">ข้อมูลการนัดหมาย</h3>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-start pb-2 border-b border-gray-50">
                                <span className="text-gray-500">บริการ</span>
                                <span className="text-gray-800 font-medium text-right ml-4">{appointment.serviceInfo?.name}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                                <span className="text-gray-500">ช่างผู้ให้บริการ</span>
                                <span className="text-gray-800 font-medium">{appointment.appointmentInfo?.technicianInfo?.firstName} {appointment.appointmentInfo?.technicianInfo?.lastName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">วันเวลา</span>
                                <span className="text-gray-800 font-medium">
                                    {new Date(appointment.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} • {appointment.time}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Review Form */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-50">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Star Rating */}
                        <div className="text-center pt-2">
                            <label className="block text-gray-700 font-medium mb-4">
                                คุณพึงพอใจกับบริการระดับไหน?
                            </label>
                            <StarRating rating={rating} setRating={setRating} />
                            <p className="text-sm font-medium text-primary mt-3 h-5">
                                {rating > 0 ? (rating === 5 ? 'ดีเยี่ยม! 🤩' : rating === 4 ? 'ดีมาก 😊' : rating === 3 ? 'ปานกลาง 🙂' : rating === 2 ? 'พอใช้ 😐' : 'ควรปรับปรุง 🙁') : ''}
                            </p>
                        </div>

                        {/* Comment */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
                                เสนอแนะเพิ่มเติม (ไม่บังคับ)
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-primary/20 text-gray-800 placeholder-gray-400 resize-none transition-all"
                                rows={4}
                                placeholder="เช่น การบริการดีมาก, บรรยากาศผ่อนคลาย..."
                                maxLength={500}
                            />
                            <div className="text-right mt-1">
                                <span className="text-xs text-gray-400">
                                    {comment.length}/500
                                </span>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl text-center">
                                {error}
                            </div>
                        )}

                        {/* Submit Buttons */}
                        <div className="space-y-3 pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting || rating === 0}
                                className="w-full bg-primary text-white py-4 rounded-2xl font-semibold shadow-sm hover:shadow-md hover:bg-primary-dark disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed transition-all transform active:scale-95"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        กำลังส่งรีวิว...
                                    </span>
                                ) : 'ส่งรีวิว'}
                            </button>

                            <button
                                type="button"
                                onClick={handleCancel}
                                className="w-full bg-white text-gray-500 py-3 rounded-2xl font-medium hover:bg-gray-50 border border-gray-100"
                            >
                                ยกเลิก
                            </button>
                        </div>
                    </form>
                </div>

                {/* Info */}
                <div className="bg-primary/5 rounded-2xl p-4 text-center">
                    <p className="text-primary text-sm font-medium">
                        ✨ ทุกความเห็นช่วยให้เราบริการคุณได้ดียิ่งขึ้น
                    </p>
                </div>
            </div>
        </div>
    );
}

// Main component that wraps ReviewContent with Suspense
export default function ReviewPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAF9F6]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-500 font-light">กำลังโหลด...</p>
            </div>
        }>
            <ReviewContent />
        </Suspense>
    );
}
