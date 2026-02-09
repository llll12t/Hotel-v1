
import { useMemo } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

interface AppointmentCardProps {
    appointment: Appointment;
    onManage: (app: Appointment) => void;
}

const AppointmentCard = ({ appointment, onManage }: AppointmentCardProps) => {
    const { profile } = useProfile();

    const appointmentDateTime = useMemo(() => {
        // Safety check for time
        if (!appointment.time) {
            // Default or fallback? if time is missing we can't calculate checkInStatus correctly
            return new Date();
        }
        const [hours, minutes] = appointment.time.split(':');
        // Safety check for date
        if (!appointment.date) {
            return new Date();
        }
        return parseISO(appointment.date as string).setHours(parseInt(hours), parseInt(minutes));
    }, [appointment.date, appointment.time]);

    const checkInStatus = useMemo(() => {
        if (!appointment.time || !appointment.date) return { text: '', color: '' };

        const diff = differenceInMinutes(appointmentDateTime, new Date());
        if (appointment.status === 'in_progress') {
            return { text: 'กำลังใช้บริการ', color: 'text-blue-600' };
        }
        if (appointment.status !== 'pending' && appointment.status !== 'confirmed' && appointment.status !== 'awaiting_confirmation') {
            return { text: '', color: '' };
        }
        if (diff > 60) {
            return { text: 'เช็คอินล่วงหน้า', color: 'text-blue-600' };
        }
        if (diff < -30) {
            return { text: 'เลยเวลานัดหมาย', color: 'text-red-600' };
        }
        return { text: 'สามารถเช็คอินได้', color: 'text-green-600' };
    }, [appointmentDateTime, appointment.status, appointment.time, appointment.date]);

    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';

    // Status Config
    const statusInfo: any = {
        awaiting_confirmation: { label: 'รอการยืนยัน', color: 'bg-yellow-100 text-yellow-800' },
        confirmed: { label: 'ยืนยันแล้ว', color: 'bg-teal-100 text-teal-800' },
        pending: { label: 'รอใช้บริการ', color: 'bg-gray-200 text-gray-800' },
        in_progress: { label: 'กำลังใช้บริการ', color: 'bg-blue-100 text-blue-800' },
        completed: { label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-800' },
        cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-800' }
    }[appointment.status as string] || { label: 'ไม่ระบุ', color: 'bg-gray-100' };

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
            {/* Header: Customer & Status */}
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg text-gray-900 truncate">{appointment.customerInfo.fullName || appointment.customerInfo.name}</p>
                    <p className="text-sm text-gray-500">{appointment.customerInfo.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {isPaid ? 'ชำระแล้ว' : 'ยังไม่ชำระ'}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                    </span>
                </div>
            </div>

            {/* Service Details */}
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <p className="font-semibold text-gray-800">{appointment.serviceInfo.name}</p>

                {/* Option-Based Details */}
                {appointment.serviceInfo?.serviceType === 'option-based' && (
                    <div className="text-sm text-gray-600 space-y-1">
                        {appointment.serviceInfo?.selectedOptionName && (
                            <div className="flex items-center gap-1">
                                <span className="text-gray-400">🏷️</span>
                                <span>{appointment.serviceInfo.selectedOptionName}</span>
                            </div>
                        )}
                        {appointment.serviceInfo?.selectedAreas && appointment.serviceInfo.selectedAreas.length > 0 && (
                            <div className="flex items-start gap-1">
                                <span className="text-gray-400">📍</span>
                                <span>{appointment.serviceInfo.selectedAreas.join(', ')} ({appointment.serviceInfo.selectedAreas.length} จุด)</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Area-Based-Options Details */}
                {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions && appointment.serviceInfo.selectedAreaOptions.length > 0 && (
                    <div className="text-sm text-gray-600 space-y-1">
                        {appointment.serviceInfo.selectedAreaOptions.map((opt: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center">
                                <span>🔸 {opt.areaName} ({opt.optionName})</span>
                                <span className="text-gray-400 text-xs">{opt.duration} นาที | {Number(opt.price).toLocaleString()} {profile.currencySymbol}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Multi-Area Details */}
                {appointment.serviceInfo?.serviceType === 'multi-area' && (
                    <div className="text-sm text-gray-600 space-y-1">
                        {appointment.serviceInfo?.selectedArea && (
                            <div className="flex items-center gap-1">
                                <span className="text-gray-400">📍</span>
                                <span>{appointment.serviceInfo.selectedArea.name}</span>
                            </div>
                        )}
                        {appointment.serviceInfo?.selectedPackage && (
                            <div className="flex items-center gap-1">
                                <span className="text-gray-400">📦</span>
                                <span>{appointment.serviceInfo.selectedPackage.name}</span>
                            </div>
                        )}
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
                                    <span className="text-xs text-blue-400">{addon.duration} นาที | {Number(addon.price).toLocaleString()} {profile.currencySymbol}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Date, Time & Price */}
            <div className="flex items-center justify-between text-sm">
                <div className="text-gray-600">
                    {appointment.date && (
                        <span>{format(parseISO(appointment.date), 'dd MMM yyyy', { locale: th })}</span>
                    )}
                    {appointment.time && (
                        <span className="ml-2 font-semibold text-gray-800">{appointment.time} น.</span>
                    )}
                    {appointment.appointmentInfo?.duration && (
                        <span className="ml-2 text-gray-400">({appointment.appointmentInfo.duration} นาที)</span>
                    )}
                </div>
                <span className="font-bold text-gray-900">{appointment.paymentInfo?.totalPrice?.toLocaleString()} {profile.currencySymbol}</span>
            </div>

            {/* Check-in Status & Action Button */}
            <div className="border-t pt-3">
                {checkInStatus.text && (
                    <p className={`text-center font-semibold mb-2 text-sm ${checkInStatus.color}`}>{checkInStatus.text}</p>
                )}
                <button
                    onClick={() => onManage(appointment)}
                    className="w-full font-bold py-3 rounded-xl transition-colors bg-gray-900 text-white hover:bg-gray-800"
                >
                    จัดการนัดหมาย
                </button>
            </div>
        </div>
    );
};

export default AppointmentCard;
