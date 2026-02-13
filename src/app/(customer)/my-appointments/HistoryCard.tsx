"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';



interface HistoryCardProps {
    appointment: Appointment;
    onBookAgain?: () => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ appointment, onBookAgain }) => {
    const { profile } = useProfile();
    // Safe date conversion
    let appointmentDateTime = new Date();
    try {
        if (appointment.bookingInfo?.checkInDate) {
            appointmentDateTime = new Date(appointment.bookingInfo.checkInDate);
        } else if (appointment.appointmentInfo?.dateTime) {
            appointmentDateTime = typeof appointment.appointmentInfo.dateTime.toDate === 'function'
                ? appointment.appointmentInfo.dateTime.toDate()
                : new Date(appointment.appointmentInfo.dateTime);
        } else {
            appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
        }
    } catch (e) {
        console.error("Invalid date in history card", e);
    }

    const title = appointment.bookingType === 'room'
        ? appointment.roomTypeInfo?.name || 'Room Booking'
        : appointment.serviceInfo?.name || 'Service Booking';

    const price = appointment.paymentInfo?.totalPrice?.toLocaleString() || '-';

    // Status color mapping
    const statusColor = appointment.status === 'completed' ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50';
    const statusText = appointment.status === 'completed' ? 'สำเร็จ' : 'ยกเลิก';

    return (
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-all">
            {/* Left: Date */}
            <div className="flex flex-col items-center justify-center min-w-[60px] h-[60px] bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-xl font-bold text-gray-900 leading-none">
                    {format(appointmentDateTime, 'd')}
                </span>
                <span className="text-xs text-gray-500 font-medium uppercase">
                    {format(appointmentDateTime, 'MMM', { locale: th })}
                </span>
            </div>

            {/* Center: Service Details */}
            <div className="flex-grow min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate">
                    {title}
                </h3>
                <div className="text-xs text-gray-500 mt-1">
                    {price} {profile?.currencySymbol || '฿'}
                </div>
            </div>

            {/* Right: Status */}
            <div>
                <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${statusColor} whitespace-nowrap`}>
                    {statusText}
                </span>
            </div>
        </div>
    );
};

export default HistoryCard;
