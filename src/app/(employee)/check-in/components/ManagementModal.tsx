
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { useToast } from '@/app/components/Toast';
import { useLiffContext } from '@/context/LiffProvider';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { updateAppointmentStatus, updatePaymentStatusByEmployee } from '@/app/actions/employeeActions';
import PaymentQrModal from './PaymentQrModal';
import { Appointment } from '@/types';

interface ManagementModalProps {
    appointment: Appointment;
    onClose: () => void;
    onAction: (app: Appointment) => void;
    profile: any;
}

const ManagementModal = ({ appointment, onClose, onAction, profile }: ManagementModalProps) => {
    const [showQr, setShowQr] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{ show: boolean, title: string, message: string, action: (() => Promise<void>) | null }>({ show: false, title: '', message: '', action: null });

    const { showToast } = useToast();
    const { liff } = useLiffContext();

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
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updatePaymentStatusByEmployee(appointment.id, profile.userId, { lineAccessToken });
        if (result.success) {
            showToast('อัปเดตสถานะการชำระเงินสำเร็จ!', 'success');
            onAction({ ...appointment, paymentInfo: { ...appointment.paymentInfo, paymentStatus: 'paid' } });
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleCheckIn = async () => {
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, 'in_progress', profile.userId, { lineAccessToken });
        if (result.success) {
            showToast('ยืนยันการเข้ารับบริการสำเร็จ!', 'success');
            onAction({ ...appointment, status: 'in_progress' });
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleStatusChange = async (newStatus: any) => {
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, newStatus, profile.userId, { lineAccessToken });
        if (result.success) {
            showToast('อัปเดตสถานะสำเร็จ!', 'success');
            onAction({ ...appointment, status: newStatus });
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
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50" onClick={onClose}></div>
            <div className="fixed bottom-0 left-0 right-0 bg-gray-100 rounded-t-2xl shadow-lg p-5 z-50 max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">จัดการนัดหมาย</h2>
                    <button onClick={onClose} className="text-gray-500 text-2xl">&times;</button>
                </div>

                {/* --- Appointment Info --- */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                    <p className="font-bold text-lg">{appointment.customerInfo.fullName || appointment.customerInfo.name}</p>
                    <p className="text-sm text-gray-600 font-semibold mb-2">{appointment.serviceInfo.name}</p>

                    {/* Multi-area service details */}
                    {appointment.serviceInfo?.serviceType === 'multi-area' && (
                        <div className="bg-gray-50 p-2 rounded-lg mb-2 text-xs">
                            {appointment.serviceInfo?.selectedArea && (
                                <p className="text-gray-700">📍 {appointment.serviceInfo.selectedArea.name}</p>
                            )}
                            {appointment.serviceInfo?.selectedPackage && (
                                <div className="text-gray-600 flex justify-between items-center">
                                    <span>📦 {appointment.serviceInfo.selectedPackage.name}</span>
                                    <span className="text-gray-500">{appointment.serviceInfo.selectedPackage.duration} นาที</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Option-based service details */}
                    {appointment.serviceInfo?.serviceType === 'option-based' && (
                        <div className="bg-gray-50 p-2 rounded-lg mb-2 text-xs space-y-1">
                            {appointment.serviceInfo?.selectedOptionName && (
                                <div className="flex justify-between items-center">
                                    <p className="text-gray-700 font-medium flex-1">
                                        🏷️ {appointment.serviceInfo.selectedOptionName}
                                        {appointment.serviceInfo.selectedAreas && appointment.serviceInfo.selectedAreas.length > 0 && (
                                            <span className="text-gray-500"> x {appointment.serviceInfo.selectedAreas.length} จุด</span>
                                        )}
                                    </p>
                                    {appointment.serviceInfo.selectedOptionDuration && (
                                        <span className="text-gray-500 ml-2">{appointment.serviceInfo.selectedOptionDuration} นาที/จุด</span>
                                    )}
                                </div>
                            )}
                            {appointment.serviceInfo?.selectedAreas && appointment.serviceInfo.selectedAreas.length > 0 && (
                                <p className="text-gray-600 pl-4">({appointment.serviceInfo.selectedAreas.join(', ')})</p>
                            )}
                        </div>
                    )}

                    {/* Area-based-options service details */}
                    {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions && appointment.serviceInfo.selectedAreaOptions.length > 0 && (
                        <div className="bg-gray-50 p-2 rounded-lg mb-2 text-xs space-y-1">
                            {appointment.serviceInfo.selectedAreaOptions.map((opt: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center">
                                    <span className="text-gray-700">🔸 {opt.areaName} ({opt.optionName})</span>
                                    <div className="text-gray-500 flex items-center gap-1">
                                        {opt.duration && <span>{opt.duration} นาที</span>}
                                        {opt.duration && opt.price && <span>�</span>}
                                        {opt.price && <span>{Number(opt.price).toLocaleString()} {profile.currencySymbol}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add-ons */}
                    {appointment.appointmentInfo?.addOns && appointment.appointmentInfo.addOns.length > 0 && (
                        <div className="bg-blue-50 p-2 rounded-lg mb-2 text-xs space-y-1">
                            <p className="font-semibold text-blue-800">บริการเสริม:</p>
                            {appointment.appointmentInfo.addOns.map((addon: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-blue-700">
                                    <span>+ {addon.name}</span>
                                    <div className="flex items-center gap-1 text-blue-600">
                                        {addon.duration && <span>{addon.duration} นาที</span>}
                                        {addon.duration && addon.price && <span>�</span>}
                                        {addon.price && <span>{Number(addon.price).toLocaleString()} {profile.currencySymbol}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <hr className="my-2" />
                    {appointment.date && (
                        <p className="text-sm"><strong>วันที่:</strong> {format(parseISO(appointment.date), 'dd MMMM yyyy', { locale: th })}</p>
                    )}
                    <p className="text-sm"><strong>เวลา:</strong> {appointment.time} น.</p>
                </div>

                {/* --- Payment Section --- */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                    <h3 className="font-semibold text-md mb-3">การชำระเงิน</h3>
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-lg">{appointment.paymentInfo?.totalPrice?.toLocaleString()} {profile.currencySymbol}</span>
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
                <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                    <h3 className="font-semibold text-md mb-3">การเข้ารับบริการ</h3>
                    {isCheckedIn ? (
                        <p className="text-center text-green-600 font-semibold bg-green-50 p-3 rounded-lg">ลูกค้าเข้ารับบริการแล้ว</p>
                    ) : (
                        <button onClick={handleCheckIn} disabled={isUpdating || !['pending', 'confirmed', 'awaiting_confirmation'].includes(appointment.status)} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold text-lg disabled:bg-gray-300 hover:bg-gray-800">
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

            <PaymentQrModal show={showQr} onClose={() => setShowQr(false)} appointment={appointment} profile={profile} />

            <ConfirmationModal
                show={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={executeConfirmAction}
                onCancel={() => setConfirmModal({ ...confirmModal, show: false })}
                isProcessing={isUpdating}
            />
        </>
    );
};

export default ManagementModal;
