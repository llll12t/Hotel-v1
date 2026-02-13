"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { cancelAppointmentByUser } from '@/app/actions/appointmentActions';
import AppointmentCard from './AppointmentCard';
import QrCodeModal from '@/app/components/common/QrCodeModal';
import HistoryCard from './HistoryCard';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

export default function MyAppointmentsPage() {
    const router = useRouter();
    const { profile, loading: liffLoading, error: liffError, liff } = useLiffContext();
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

            // --- กรองข้อมูลนัดหมายปัจจุบัน ---
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

            // --- กรองประวัติย้อนหลัง ---
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

    // --- Loading Screen ---
    if (liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)]">
                <SpaFlowerIcon className="w-16 h-16 animate-spin text-[var(--primary)]" style={{ animationDuration: '3s' }} />
            </div>
        );
    }

    if (liffError) return <div className="p-4 text-center text-[var(--error)]">LIFF Error: {liffError}</div>;

    return (
        <div className="min-h-screen bg-[#f6f6f6] text-gray-900 font-sans">
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            <div className="p-4 space-y-5 pb-20">
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

                <div className="space-y-4">
                    <h1 className="text-xl font-bold text-gray-900 px-1">นัดหมายของฉัน</h1>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <SpaFlowerIcon className="w-10 h-10 animate-spin text-gray-400" style={{ animationDuration: '3s' }} />
                        </div>
                    ) : appointments.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                            <p className="font-medium text-gray-500 mb-4">ไม่มีรายการจองที่กำลังดำเนินการ</p>
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
                </div>

                <div className="flex flex-col items-center mt-8">
                    <button
                        className="text-gray-500 flex items-center gap-2 font-medium bg-white border border-gray-200 px-5 py-2.5 rounded-full shadow-sm hover:bg-gray-50 transition-colors pointer-events-auto"
                        onClick={() => setShowHistory(v => !v)}
                    >
                        <span className="text-sm">{showHistory ? '▲ ซ่อนประวัติ' : '▼ ดูประวัติการจอง'}</span>
                    </button>
                </div>

                {showHistory && (
                    <div className="space-y-3 mt-4 animate-fade-in-up">
                        {historyBookings.length === 0 ? (
                            <div className="text-center text-gray-400 py-8 bg-white rounded-xl border border-gray-100">
                                <p className="text-sm">ไม่มีประวัติการจอง</p>
                            </div>
                        ) : (
                            historyBookings.slice(0, 10).map(job => (
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
    );
}
