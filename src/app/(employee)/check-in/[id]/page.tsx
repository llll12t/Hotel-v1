
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
                const result = await findAppointmentById(id, { lineAccessToken });
                if (result.success && result.appointment) {
                    setAppointment(result.appointment);
                } else {
                    showToast('ไม่พบข้อมูลนัดหมาย', 'error');
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

    const executeConfirmAction = async () => {
        if (confirmModal.action) {
            await confirmModal.action();
        }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const handleUpdatePayment = async () => {
        if (!liffProfile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updatePaymentStatusByEmployee(appointment.id, liffProfile.userId, { lineAccessToken });
        if (result.success) {
            showToast('อัปเดตสถานะการชำระเงินสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, paymentInfo: { ...prev.paymentInfo, paymentStatus: 'paid' } }) : null);
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleCheckIn = async () => {
        if (!liffProfile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, 'in_progress', liffProfile.userId, { lineAccessToken });
        if (result.success) {
            showToast('ยืนยันการเข้ารับบริการสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, status: 'in_progress' }) : null);
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleStatusChange = async (newStatus: any) => {
        if (!liffProfile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, newStatus, liffProfile.userId, { lineAccessToken });
        if (result.success) {
            showToast('อัปเดตสถานะสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, status: newStatus }) : null);
            if (newStatus === 'cancelled') {
                // Optionally redirect back after cancel
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

    const confirmComplete = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันเสร็จสิ้นบริการ",
            message: "ต้องการบันทึกว่าการบริการนี้เสร็จสิ้นแล้วใช่หรือไม่?",
            action: async () => handleStatusChange('completed')
        });
    };

    const confirmCancel = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการยกเลิก",
            message: "คุณต้องการยกเลิกนัดหมายนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
            action: async () => handleStatusChange('cancelled')
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-safe">
            <EmployeeHeader showBackButton />

            <main className="p-4 space-y-4 max-w-lg mx-auto">
                <div className="grid gap-4">
                    {/* --- Appointment Info --- */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        {/* Customer Info */}
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <p className="font-bold text-lg text-gray-900">{appointment.customerInfo.fullName || appointment.customerInfo.name}</p>
                                <p className="text-sm text-gray-500">{appointment.customerInfo.phone}</p>
                            </div>
                        </div>

                        {/* Service Details */}
                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                            <p className="font-semibold text-gray-800">{appointment.serviceInfo.name}</p>

                            {/* Standard service - show base duration if available */}
                            {(!appointment.serviceInfo?.serviceType || appointment.serviceInfo?.serviceType === 'standard') && (
                                <div className="text-sm text-gray-600">
                                    {appointment.appointmentInfo?.duration && (
                                        <p>⏱ ระยะเวลา: {appointment.appointmentInfo.duration} นาที</p>
                                    )}
                                </div>
                            )}

                            {/* Multi-area service details */}
                            {appointment.serviceInfo?.serviceType === 'multi-area' && (
                                <div className="text-sm text-gray-600 space-y-1">
                                    {appointment.serviceInfo?.selectedArea && (
                                        <div className="flex items-center gap-1">
                                            <span>📍</span>
                                            <span>{appointment.serviceInfo.selectedArea.name}</span>
                                        </div>
                                    )}
                                    {appointment.serviceInfo?.selectedPackage && (
                                        <div className="flex justify-between items-center">
                                            <span>📦 {appointment.serviceInfo.selectedPackage.name}</span>
                                            <span className="text-gray-400">{appointment.serviceInfo.selectedPackage.duration} นาที</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Option-based service details */}
                            {appointment.serviceInfo?.serviceType === 'option-based' && (
                                <div className="text-sm text-gray-600 space-y-1">
                                    {appointment.serviceInfo?.selectedOptionName && (
                                        <div className="flex justify-between items-center">
                                            <span>🏷️ {appointment.serviceInfo.selectedOptionName}</span>
                                            {appointment.serviceInfo.selectedOptionDuration && (
                                                <span className="text-gray-400">{appointment.serviceInfo.selectedOptionDuration} นาที/จุด</span>
                                            )}
                                        </div>
                                    )}
                                    {appointment.serviceInfo?.selectedAreas && appointment.serviceInfo.selectedAreas.length > 0 && (
                                        <div className="flex items-start gap-1">
                                            <span>📍</span>
                                            <span>{appointment.serviceInfo.selectedAreas.join(', ')} ({appointment.serviceInfo.selectedAreas.length} จุด)</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Area-based-options service details */}
                            {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions && appointment.serviceInfo.selectedAreaOptions.length > 0 && (
                                <div className="text-sm text-gray-600 space-y-1">
                                    {appointment.serviceInfo.selectedAreaOptions.map((opt: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span>🔸 {opt.areaName} ({opt.optionName})</span>
                                            <div className="text-gray-400 flex items-center gap-1 text-xs">
                                                {opt.duration && <span>{opt.duration} นาที</span>}
                                                {opt.duration && opt.price && <span>•</span>}
                                                {opt.price && <span>{Number(opt.price).toLocaleString()} {storeProfile?.currencySymbol}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add-ons */}
                            {appointment.appointmentInfo?.addOns && appointment.appointmentInfo.addOns.length > 0 && (
                                <div className="border-t border-gray-200 pt-2 mt-2">
                                    <p className="text-xs font-semibold text-blue-700 mb-1">บริการเสริม:</p>
                                    <div className="text-sm text-blue-600 space-y-0.5">
                                        {appointment.appointmentInfo.addOns.map((addon: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center">
                                                <span>+ {addon.name}</span>
                                                <div className="flex items-center gap-1 text-blue-400 text-xs">
                                                    {addon.duration && <span>{addon.duration} นาที</span>}
                                                    {addon.duration && addon.price && <span>•</span>}
                                                    {addon.price && <span>{Number(addon.price).toLocaleString()} {storeProfile?.currencySymbol}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Total Duration */}
                            {appointment.appointmentInfo?.duration && (
                                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center text-sm">
                                    <span className="font-semibold text-gray-700">ระยะเวลารวม</span>
                                    <span className="font-bold text-gray-900">{appointment.appointmentInfo.duration} นาที</span>
                                </div>
                            )}
                        </div>

                        {/* Date & Time */}
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <div className="text-gray-600">
                                {appointment.date && (
                                    <span className="font-medium">{format(parseISO(appointment.date), 'dd MMMM yyyy', { locale: th })}</span>
                                )}
                            </div>
                            <span className="font-bold text-gray-900 text-lg">{appointment.time} น.</span>
                        </div>
                    </div>

                    {/* --- Payment Section --- */}
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-md mb-3">การชำระเงิน</h3>
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-lg">{appointment.paymentInfo?.totalPrice?.toLocaleString()} {storeProfile?.currencySymbol}</span>
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

                    {/* --- Check-in Section --- */}
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-md mb-3">การเข้ารับบริการ</h3>
                        {isCheckedIn ? (
                            <div className="text-center bg-green-50 p-4 rounded-lg border border-green-100">
                                <div className="text-green-600 text-xl font-bold mb-1">✓ กำลังให้บริการ</div>
                                <p className="text-green-800 text-sm">ลูกค้าเข้ารับบริการแล้ว</p>
                            </div>
                        ) : (
                            <button onClick={handleCheckIn} disabled={isUpdating || !['pending', 'confirmed', 'awaiting_confirmation'].includes(appointment.status)} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold text-lg disabled:bg-gray-300 hover:bg-gray-800 shadow-md">
                                ยืนยันการเข้ารับบริการ
                            </button>
                        )}
                    </div>

                    {/* --- Other Actions --- */}
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-md mb-3">การดำเนินการอื่นๆ</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={confirmComplete} disabled={isUpdating || appointment.status === 'completed'} className="w-full bg-gray-700 text-white py-2 rounded-lg font-semibold disabled:bg-gray-300 hover:bg-gray-800">เสร็จสิ้นบริการ</button>
                            <button onClick={confirmCancel} disabled={isUpdating || appointment.status === 'cancelled'} className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold disabled:bg-gray-300 hover:bg-red-700">ยกเลิกนัด</button>
                        </div>
                    </div>
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
