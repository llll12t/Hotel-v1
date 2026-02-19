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
import LoadingIcon from '@/app/components/common/LoadingIcon';
import Link from 'next/link';
import { Appointment } from '@/types';

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

    // ---- Loading / Error States ----
    if (liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <LoadingIcon className="w-12 h-12 text-gray-400" />
            </div>
        );
    }
    if (liffError) return <div className="p-4 text-center text-red-500">LIFF Error: {liffError}</div>;

    const headerBgUrl = storeProfile?.headerImage;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-[#1A1A1A]">
            <Notification {...notification} />
            <ConfirmationModal
                show={!!appointmentToCancel}
                title="ยืนยันการยกเลิก"
                message={`คุณต้องการยกเลิกการจอง ${appointmentToCancel?.bookingType === 'room' ? 'ห้องพัก' : 'บริการ'} ใช่หรือไม่?`}
                onConfirm={confirmCancelAppointment}
                onCancel={() => setAppointmentToCancel(null)}
                isProcessing={isCancelling}
            />
            <QrCodeModal
                show={showQrModal}
                onClose={() => setShowQrModal(false)}
                appointmentId={selectedAppointmentId}
            />

            {/* ── Header ── */}
            <div className="relative h-[165px] w-full overflow-hidden">
                {/* BG Image */}
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

                {/* Header Content */}
                <div className="relative z-10 h-full flex items-center justify-between px-6 pb-12">
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
            <div className="bg-white rounded-[28px] -mt-8 relative z-20 min-h-[calc(100vh-120px)] mx-3 pb-20 shadow-sm">

                {/* Tab Bar */}
                <div className="px-4 pt-5 pb-4 flex gap-2.5">
                    {/* Active tab */}
                    <button className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] text-white py-3.5 rounded-2xl font-bold text-sm shadow-md">
                        <CalendarIcon />
                        <span>การนัดหมายของฉัน</span>
                    </button>

                    {/* Inactive tab */}
                    <Link href="/my-coupons" className="flex-1">
                        <div className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-500 py-3.5 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition-all">
                            <GiftIcon />
                            <span>คูปอง</span>
                        </div>
                    </Link>
                </div>

                {/* Content */}
                <div className="px-4 pt-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <LoadingIcon className="w-10 h-10 text-gray-300" />
                        </div>
                    ) : appointments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <CalendarIcon />
                            </div>
                            <p className="font-bold text-gray-900 mb-1">ไม่มีการจองในขณะนี้</p>
                            <p className="text-xs text-gray-500 mb-6 leading-relaxed">เริ่มจองห้องพักหรือบริการของคุณได้เลย</p>
                            <button
                                className="px-6 py-3 bg-[#1A1A1A] text-white text-sm rounded-xl font-bold hover:opacity-90 transition-all shadow-lg active:scale-95"
                                onClick={() => router.push('/appointment')}
                            >
                                จองเลย
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {appointments.map((job) => (
                                <AppointmentCard
                                    key={job.id}
                                    job={job}
                                    onQrCodeClick={() => handleQrCodeClick(job.id!)}
                                    onCancelClick={handleCancelClick}
                                />
                            ))}
                        </div>
                    )}

                    {/* History Button */}
                    <div className="mt-4 mb-2">
                        <button
                            onClick={() => setShowHistory(v => !v)}
                            className="w-full py-3 bg-white border border-gray-200 rounded-2xl text-sm text-gray-500 font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {showHistory ? 'ซ่อนประวัติ' : 'ประวัติการจอง'}
                        </button>
                    </div>

                    {/* History List */}
                    {showHistory && (
                        <div className="space-y-3 mt-3 pb-6 animate-fade-in-up">
                            {historyBookings.length === 0 ? (
                                <p className="text-center text-xs text-gray-400 py-6">ยังไม่มีประวัติการจอง</p>
                            ) : (
                                historyBookings.map(job => (
                                    <HistoryCard
                                        key={job.id}
                                        appointment={job}
                                        onBookAgain={() => { router.push('/appointment'); }}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
