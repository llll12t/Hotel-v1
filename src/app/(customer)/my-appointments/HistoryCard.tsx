"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

const statusConfig: Record<string, { text: string; color: string }> = {
    'completed': { text: 'สำเร็จ', color: 'text-green-600 bg-green-50' },
    'cancelled': { text: 'ยกเลิก', color: 'text-red-600 bg-red-50' },
};

interface HistoryCardProps {
    appointment: Appointment;
    onBookAgain?: () => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ appointment, onBookAgain }) => {
    const { profile } = useProfile();
    // Safe date conversion
    let appointmentDateTime = new Date();
    try {
        if (appointment.appointmentInfo?.dateTime) {
            appointmentDateTime = typeof appointment.appointmentInfo.dateTime.toDate === 'function'
                ? appointment.appointmentInfo.dateTime.toDate()
                : new Date(appointment.appointmentInfo.dateTime);
        } else {
            // Fallback if appointmentInfo or dateTime is missing, use date/time fields
            appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
        }
    } catch (e) {
        console.error("Invalid date in history card", e);
    }

    // Status text fallback
    const statusText = appointment.status || 'unknown';
    const statusInfo = statusConfig[statusText] || { text: statusText, color: 'text-gray-600 bg-gray-50' };

    // สรุปชื่อบริการ + รายละเอียดแบบย่อ
    const serviceName = appointment.serviceInfo?.name || 'Unknown Service';
    const price = appointment.paymentInfo?.totalPrice?.toLocaleString() || '-';

    return (
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center justify-between gap-3">
            {/* Left: Date & Time */}
            <div className="flex flex-col items-center min-w-[50px] pr-3 border-r border-gray-100">
                <span className="text-xl font-bold text-gray-800 leading-none">
                    {format(appointmentDateTime, 'd')}
                </span>
                <span className="text-xs text-gray-500">
                    {format(appointmentDateTime, 'MMM', { locale: th })}
                </span>
                <span className="text-[10px] text-gray-400 mt-1">
                    {format(appointmentDateTime, 'HH:mm')}
                </span>
            </div>

            {/* Center: Service Details */}
            <div className="flex-grow min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {serviceName}
                </h3>
                <div className="text-xs text-gray-500 truncate">
                    {/* แสดงรายละเอียดแบบย่อๆ บรรทัดเดียว */}
                    {appointment.serviceInfo?.selectedPackage && <span>{appointment.serviceInfo.selectedPackage.name} </span>}
                    {appointment.serviceInfo?.selectedOptionName && <span>{appointment.serviceInfo.selectedOptionName} </span>}
                    {appointment.serviceInfo?.selectedArea && <span>{appointment.serviceInfo.selectedArea.name} </span>}
                    {appointment.appointmentInfo?.addOns && appointment.appointmentInfo.addOns.length > 0 && (
                        <span className="text-[#5D4037]">+ {appointment.appointmentInfo.addOns.length} บริการเสริม</span>
                    )}
                </div>
            </div>

            {/* Right: Status & Price */}
            <div className="text-right flex flex-col items-end gap-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusInfo.color} whitespace-nowrap`}>
                    {statusInfo.text}
                </span>
                <span className="text-sm font-bold text-[#5D4037]">
                    {price} {profile?.currencySymbol || '฿'}
                </span>
            </div>
        </div>
    );
};

export default HistoryCard;
