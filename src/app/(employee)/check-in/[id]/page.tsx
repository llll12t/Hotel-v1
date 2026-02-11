
"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { useLiffContext } from '@/context/LiffProvider';
import { useToast } from '@/app/components/Toast';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { updateAppointmentStatus, updatePaymentStatusByEmployee, findAppointmentById } from '@/app/actions/employeeActions';
import PaymentQrModal from '../components/PaymentQrModal';
import EmployeeHeader from '@/app/components/EmployeeHeader';
import { Appointment } from '@/types';
import { auth } from '@/app/lib/firebase';

export default function AppointmentManagementPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { profile: storeProfile } = useProfile();
    const { profile: liffProfile, liff } = useLiffContext();
    const { showToast } = useToast();

    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [loading, setLoading] = useState(true);
    const [showQr, setShowQr] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{ show: boolean, title: string, message: string, action: (() => Promise<void>) | null }>({ show: false, title: '', message: '', action: null });

    useEffect(() => {
        const fetchAppointment = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const lineAccessToken = liff?.getAccessToken?.();
                const adminToken = await auth.currentUser?.getIdToken();
                const result = await findAppointmentById(id, { lineAccessToken, adminToken });
                if (result.success && result.appointment) {
                    setAppointment(result.appointment);
                } else {
                    showToast('ไม่พบข้อมูลการจอง', 'error');
                    router.back();
                }
            } catch (error) {
                console.error("Error fetching appointment:", error);
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
                router.back();
            } finally {
                setLoading(false);
            }
        };

        fetchAppointment();
    }, [id, router, showToast]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <EmployeeHeader showBackButton />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!appointment) return null;

    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';
    const isCheckedIn = appointment.status === 'in_progress';
    const isCompleted = appointment.status === 'completed';
    const isRoomBooking = appointment.bookingType === 'room';

    const executeConfirmAction = async () => {
        if (confirmModal.action) {
            await confirmModal.action();
        }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const handleUpdatePayment = async () => {
        const adminToken = await auth.currentUser?.getIdToken();
        const empId = liffProfile?.userId || (adminToken ? 'admin' : '');

        if (!empId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updatePaymentStatusByEmployee(appointment.id, empId, { lineAccessToken, adminToken });
        if (result.success) {
            showToast('อัปเดตสถานะการชำระเงินสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, paymentInfo: { ...prev.paymentInfo, paymentStatus: 'paid' } }) : null);
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleCheckIn = async () => {
        const adminToken = await auth.currentUser?.getIdToken();
        const empId = liffProfile?.userId || (adminToken ? 'admin' : '');

        if (!empId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, 'in_progress', empId, { lineAccessToken, adminToken });
        if (result.success) {
            showToast('ยืนยันลูกค้าเช็คอินสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, status: 'in_progress' }) : null);
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleCheckOut = async () => {
        const adminToken = await auth.currentUser?.getIdToken();
        const empId = liffProfile?.userId || (adminToken ? 'admin' : '');

        if (!empId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, 'completed', empId, { lineAccessToken, adminToken });
        if (result.success) {
            showToast('ยืนยันลูกค้าเช็คเอาท์สำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, status: 'completed' }) : null);
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleStatusChange = async (newStatus: any) => {
        const adminToken = await auth.currentUser?.getIdToken();
        const empId = liffProfile?.userId || (adminToken ? 'admin' : '');

        if (!empId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, newStatus, empId, { lineAccessToken, adminToken });
        if (result.success) {
            showToast('อัปเดตสถานะสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, status: newStatus }) : null);
            if (newStatus === 'cancelled') {
                setTimeout(() => router.back(), 1500);
            }
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    }

    const confirmPayment = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการชำระเงิน",
            message: "ยืนยันว่าลูกค้าได้ชำระเงินครบถ้วนแล้วใช่หรือไม่?",
            action: handleUpdatePayment
        });
    };

    const confirmCheckOut = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการเช็คเอาท์",
            message: "ต้องการบันทึกว่าลูกค้าเช็คเอาท์และคืนห้องพักแล้วใช่หรือไม่?",
            action: handleCheckOut
        });
    };

    const confirmCancel = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการยกเลิก",
            message: "คุณต้องการยกเลิกการจองนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
            action: async () => handleStatusChange('cancelled')
        });
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return format(parseISO(dateStr), 'dd MMM yyyy', { locale: th });
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-safe">
            <EmployeeHeader showBackButton />

            <main className="p-4 space-y-4 max-w-lg mx-auto">
                <div className="grid gap-4">
                    {/* --- Booking Info --- */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        {/* Customer Info */}
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <p className="font-bold text-lg text-gray-900">{appointment.customerInfo?.fullName || appointment.customerInfo?.name || 'ลูกค้าทั่วไป'}</p>
                                <p className="text-sm text-gray-500">{appointment.customerInfo?.phone}</p>
                            </div>
                        </div>

                        {/* Room/Booking Details */}
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                            {isRoomBooking ? (
                                <>
                                    <p className="font-semibold text-gray-800">{appointment.roomTypeInfo?.name || 'ไม่ระบุประเภทห้อง'}</p>
                                    <div className="text-sm text-gray-600">
                                        {appointment.bookingInfo?.roomId && (
                                            <div className="flex items-center gap-1 mb-1">
                                                <span>🚪 ห้อง: {appointment.bookingInfo.roomId}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-gray-500">เข้าพัก:</span>
                                            <span className="font-medium text-gray-900">{formatDate(appointment.bookingInfo?.checkInDate)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500">ออก:</span>
                                            <span className="font-medium text-gray-900">{formatDate(appointment.bookingInfo?.checkOutDate)}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-2">
                                            {appointment.bookingInfo?.nights || 1} คืน, {appointment.bookingInfo?.rooms || 1} ห้อง, {appointment.bookingInfo?.guests || 1} ท่าน
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // Fallback
                                <p className="font-semibold text-gray-800">{appointment.serviceInfo?.name}</p>
                            )}
                        </div>
                    </div>

                    {/* --- Payment Section --- */}
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-md mb-3">การชำระเงิน</h3>
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-lg">{appointment.paymentInfo?.totalPrice?.toLocaleString()} {storeProfile?.currencySymbol || '฿'}</span>
                            <span className={`font-semibold px-3 py-1 rounded-full text-sm ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {isPaid ? 'ชำระเงินแล้ว' : 'ยังไม่ชำระ'}
                            </span>
                        </div>
                        {!isPaid && (
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setShowQr(true)} disabled={isUpdating} className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold disabled:bg-gray-100 hover:bg-gray-300">แสดง QR</button>
                                <button onClick={confirmPayment} disabled={isUpdating} className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold disabled:bg-gray-300 hover:bg-green-700">ยืนยันชำระเงิน</button>
                            </div>
                        )}
                    </div>

                    {/* --- Status Action Section --- */}
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-md mb-3">สถานะการเข้าพัก</h3>

                        {isCompleted && (
                            <div className="text-center bg-gray-100 p-4 rounded-lg border border-gray-200">
                                <div className="text-gray-600 text-lg font-bold mb-1">เช็คเอาท์เรียบร้อย</div>
                            </div>
                        )}

                        {isCheckedIn && (
                            <div className="space-y-3">
                                <div className="text-center bg-green-50 p-4 rounded-lg border border-green-100">
                                    <div className="text-green-600 text-xl font-bold mb-1">✓ เข้าพักอยู่</div>
                                    <p className="text-green-800 text-sm">ลูกค้าเช็คอินแล้ว</p>
                                </div>
                                <button onClick={confirmCheckOut} disabled={isUpdating} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold text-lg disabled:bg-gray-300 hover:bg-gray-800 shadow-md">
                                    แจ้งเช็คเอาท์ (Check-out)
                                </button>
                            </div>
                        )}

                        {!isCheckedIn && !isCompleted && appointment.status !== 'cancelled' && (
                            <button onClick={handleCheckIn} disabled={isUpdating} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg disabled:bg-gray-300 hover:bg-blue-700 shadow-md">
                                ยืนยันลูกค้าเข้าพัก (Check-in)
                            </button>
                        )}

                        {appointment.status === 'cancelled' && (
                            <div className="text-center bg-red-50 p-4 rounded-lg border border-red-100">
                                <div className="text-red-600 text-lg font-bold">ยกเลิกแล้ว</div>
                            </div>
                        )}
                    </div>

                    {/* --- Other Actions --- */}
                    {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <h3 className="font-semibold text-md mb-3">การดำเนินการอื่นๆ</h3>
                            <button onClick={confirmCancel} disabled={isUpdating} className="w-full bg-red-50 text-red-600 py-2 rounded-lg font-semibold disabled:bg-gray-100 hover:bg-red-100 border border-red-100">
                                ยกเลิกการจอง
                            </button>
                        </div>
                    )}
                </div>
            </main>

            <PaymentQrModal show={showQr} onClose={() => setShowQr(false)} appointment={appointment} profile={storeProfile} />

            <ConfirmationModal
                show={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={executeConfirmAction}
                onCancel={() => setConfirmModal({ ...confirmModal, show: false })}
                isProcessing={isUpdating}
            />
        </div>
    );
}
