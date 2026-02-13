"use client";

import { useState, useEffect } from 'react';
import { useProfile } from '@/context/ProfileProvider';
import { db } from '@/app/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { cancelAppointmentByUser } from '@/app/actions/appointmentActions';
import AppointmentCard from './AppointmentCard';
import QrCodeModal from '@/app/components/common/QrCodeModal';
import HistoryCard from './HistoryCard';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
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

export default function MyAppointmentsPage() {
    const router = useRouter();
    const { profile, loading: liffLoading, error: liffError, liff } = useLiffContext();
    const { profile: storeProfile } = useProfile();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [historyBookings, setHistoryBookings] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [notification, setNotification] = useState<{ show: boolean, title: string, message: string, type: 'success' | 'error' | 'warning' }>({ show: false, title: '', message: '', type: 'success' });
    const [showQrModal, setShowQrModal] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => setNotification({ ...notification, show: false }), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (liffLoading) return;

        if (!profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }

        setLoading(true);

        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where("userId", "==", profile.userId)
        );

        const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
            const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

            const activeStatus = ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'];
            const filteredDocs = allDocs
                .filter(doc => activeStatus.includes(doc.status))
                .sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time}`);
                    const dateB = new Date(`${b.date}T${b.time}`);
                    return dateA.getTime() - dateB.getTime();
                });

            setAppointments(filteredDocs);
            setLoading(false);

            const historyStatus = ["completed", "cancelled"];
            const historyDocs = allDocs
                .filter(doc => historyStatus.includes(doc.status))
                .sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time}`);
                    const dateB = new Date(`${b.date}T${b.time}`);
                    return dateB.getTime() - dateA.getTime();
                });
            setHistoryBookings(historyDocs);

        }, (error) => {
            console.error("Error fetching appointments:", error);
            setNotification({ show: true, title: 'Error', message: 'Connection Error. Please retry.', type: 'error' });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profile, liffLoading]);

    const handleQrCodeClick = (appointmentId: string) => {
        setSelectedAppointmentId(appointmentId);
        setShowQrModal(true);
    };

    const handleCancelClick = (appointment: Appointment) => {
        setAppointmentToCancel(appointment);
    };

    const confirmCancelAppointment = async () => {
        if (!appointmentToCancel || !profile?.userId || !appointmentToCancel.id) return;
        setIsCancelling(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await cancelAppointmentByUser(appointmentToCancel.id, profile.userId, { lineAccessToken });
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'ยกเลิกนัดหมายแล้ว', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: typeof result.error === 'string' ? result.error : 'Unknown error', type: 'error' });
        }
        setIsCancelling(false);
        setAppointmentToCancel(null);
    };

    if (liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)]">
                <SpaFlowerIcon className="w-16 h-16 animate-spin text-[var(--primary)]" style={{ animationDuration: '3s' }} />
            </div>
        );
    }
    if (liffError) return <div className="p-4 text-center text-[var(--error)]">LIFF Error: {liffError}</div>;

    // Header Background Image (Luxury Night Pool)
    const headerBgUrl = storeProfile?.headerImage || "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&q=80&w=2070";

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-[#1A1A1A]">
            <Notification {...notification} />

            <ConfirmationModal
                show={!!appointmentToCancel}
                title="ยืนยันการยกเลิก"
                message={`คุณต้องการยกเลิกการนัดหมาย ${appointmentToCancel?.bookingType === 'room' ? 'ห้องพัก' : 'บริการ'} ใช่หรือไม่?`}
                onConfirm={confirmCancelAppointment}
                onCancel={() => setAppointmentToCancel(null)}
                isProcessing={isCancelling}
            />
            <QrCodeModal
                show={showQrModal}
                onClose={() => setShowQrModal(false)}
                appointmentId={selectedAppointmentId}
            />

            {/* --- Custom Header --- */}
            <div className="relative h-[200px] w-full overflow-hidden">
                {/* Background Image & Overlay */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${headerBgUrl})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/60"></div>
                </div>

                {/* Header Content */}
                <div className="relative z-10 px-5 pt-8 flex justify-between items-start">
                    {/* User Profile */}
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

                    {/* Status Box (Matching reference white style) */}
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
                    <button className="flex-1 bg-black text-white py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-gray-900 transition-all font-bold text-[13px] tracking-wide">
                        <CalendarIcon />
                        <span>การนัดหมาย</span>
                    </button>

                    <Link href="/my-coupons" className="flex-1">
                        <div className="bg-white border border-gray-100/50 text-gray-500 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all font-bold text-[13px] tracking-wide shadow-sm ring-1 ring-gray-100">
                            <GiftIcon />
                            <span>คูปอง</span>
                        </div>
                    </Link>
                </div>

                {/* Appointments List */}
                <div className="px-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <SpaFlowerIcon className="w-10 h-10 animate-spin text-gray-400" style={{ animationDuration: '3s' }} />
                        </div>
                    ) : appointments.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CalendarIcon />
                            </div>
                            <p className="font-medium text-gray-900 mb-2">ไม่มีการจองในขณะนี้</p>
                            <p className="text-xs text-gray-500 mb-6">เริ่มจองห้องพักผ่อนของคุณได้เลย</p>
                            <button
                                className="px-6 py-3 bg-black text-white text-sm rounded-xl font-bold hover:opacity-90 transition-all shadow-lg active:scale-95"
                                onClick={() => router.push('/appointment')}
                            >
                                จองห้องพักใหม่
                            </button>
                        </div>
                    ) : (
                        appointments.map((job) => (
                            <AppointmentCard
                                key={job.id}
                                job={job}
                                onQrCodeClick={() => handleQrCodeClick(job.id!)}
                                onCancelClick={handleCancelClick}
                            />
                        ))
                    )}

                    {/* History Toggle */}
                    <div className="flex flex-col items-center mt-8 pb-10">
                        <button
                            className="text-gray-400 flex items-center gap-2 font-medium text-xs hover:text-gray-600 transition-colors"
                            onClick={() => setShowHistory(v => !v)}
                        >
                            <span className="text-xs">{showHistory ? '▲ ซ่อนประวัติ' : '▼ ดูประวัติการจอง'}</span>
                        </button>

                        {showHistory && (
                            <div className="w-full mt-4 space-y-4 animate-fade-in-up">
                                {historyBookings.map(job => (
                                    <HistoryCard
                                        key={job.id}
                                        appointment={job}
                                        onBookAgain={() => { router.push('/appointment'); }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
