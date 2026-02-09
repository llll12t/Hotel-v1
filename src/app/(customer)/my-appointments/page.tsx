"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { cancelAppointmentByUser, confirmAppointmentByUser } from '@/app/actions/appointmentActions';
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
    const [isConfirming, setIsConfirming] = useState(false);

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

    const handleConfirmClick = async (appointment: Appointment) => {
        if (!profile?.userId || !appointment.id) return;
        setIsConfirming(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await confirmAppointmentByUser(appointment.id, profile.userId, { lineAccessToken });
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'ยืนยันการนัดหมายเรียบร้อย', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: typeof result.error === 'string' ? result.error : 'Unknown error', type: 'error' });
        }
        setIsConfirming(false);
    };

    // --- Loading Screen ---
    if (liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
            </div>
        );
    }

    if (liffError) return <div className="p-4 text-center text-red-500">LIFF Error: {liffError}</div>;

    return (
        <div>
            <CustomerHeader showBackButton={true} showActionButtons={true} />
            <div className="p-4 space-y-5 pb-20">
                <Notification {...notification} />

                <ConfirmationModal
                    show={!!appointmentToCancel}
                    title="ยืนยันการยกเลิก"
                    message={`คุณต้องการยกเลิกการนัดหมายบริการ ${appointmentToCancel?.serviceInfo.name} ใช่หรือไม่?`}
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
                    <div className="font-bold text-md text-gray-700">นัดหมายของฉัน</div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <SpaFlowerIcon className="w-14 h-14 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
                            <p className="text-sm text-gray-400 mt-2">Loading data...</p>
                        </div>
                    ) : appointments.length === 0 ? (
                        <div className="text-center text-gray-500 pt-10 bg-white p-8 rounded-xl shadow-sm">
                            <p className="font-semibold">ไม่มีรายการนัดหมายที่กำลังดำเนินอยู่</p>
                            <button className="mt-4 px-4 py-2 bg-[#5D4037] text-white text-sm rounded-lg" onClick={() => router.push('/appointment')}>จองบริการใหม่</button>
                        </div>
                    ) : (
                        appointments.map((job) => (
                            <AppointmentCard
                                key={job.id}
                                job={job}
                                onQrCodeClick={() => handleQrCodeClick(job.id!)}
                                onCancelClick={handleCancelClick}
                                onConfirmClick={handleConfirmClick}
                                isConfirming={isConfirming}
                            />
                        ))
                    )}
                </div>

                <div className="flex flex-col items-center mt-6">
                    <button className="text-gray-700 flex items-center gap-2 focus:outline-none hover:text-gray-900 font-medium bg-white px-4 py-2 rounded-full shadow-sm" onClick={() => setShowHistory(v => !v)}>
                        <span className="text-sm">{showHistory ? '▲ ซ่อนประวัติที่ผ่านมา' : '▼ ดูประวัติที่ผ่านมา'}</span>
                    </button>
                </div>

                {showHistory && (
                    <div className="space-y-4 mt-2 animate-fade-in-up">
                        <div className="text-sm text-gray-700 font-medium ml-1">ประวัติการใช้บริการ</div>
                        {historyBookings.length === 0 ? (
                            <div className="text-center text-gray-500 py-8 bg-white p-4 rounded-xl border border-gray-100">
                                <p className="text-sm">ยังไม่มีประวัติการใช้บริการ</p>
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
