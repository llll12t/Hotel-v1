
import { useMemo } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

interface AppointmentCardProps {
    appointment: Appointment;
    onManage: (app: Appointment) => void;
}

const AppointmentCard = ({ appointment, onManage }: AppointmentCardProps) => {
    const { profile } = useProfile();

    const isRoomBooking = appointment.bookingType === 'room';

    const checkInStatus = useMemo(() => {
        if (!appointment.date) return { text: '', color: '' };

        const status = appointment.status;
        if (status === 'in_progress') {
            return { text: 'เข้าพักอยู่', color: 'text-blue-600' };
        }
        if (status === 'completed') {
            return { text: 'เช็คเอาท์แล้ว', color: 'text-gray-600' };
        }
        if (['pending', 'confirmed', 'awaiting_confirmation'].includes(status)) {
            // Check if today is check-in day
            const today = format(new Date(), 'yyyy-MM-dd');
            const checkInDate = isRoomBooking ? appointment.bookingInfo?.checkInDate : appointment.date;

            if (checkInDate === today) {
                return { text: 'เช็คอินวันนี้', color: 'text-green-600' };
            }
            if (checkInDate && checkInDate < today) {
                return { text: 'เลยกำหนดเช็คอิน', color: 'text-red-600' };
            }
            return { text: 'รอดำเนินการ', color: 'text-gray-500' };
        }
        return { text: '', color: '' };
    }, [appointment, isRoomBooking]);

    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';

    // Status Config
    const statusInfo: any = {
        awaiting_confirmation: { label: 'รอยืนยัน', color: 'bg-yellow-100 text-yellow-800' },
        confirmed: { label: 'ยืนยันแล้ว', color: 'bg-teal-100 text-teal-800' },
        pending: { label: 'รอชำระ/ดำเนินการ', color: 'bg-gray-200 text-gray-800' },
        in_progress: { label: 'เข้าพักอยู่', color: 'bg-blue-100 text-blue-800' },
        completed: { label: 'เช็คเอาท์แล้ว', color: 'bg-gray-100 text-gray-800' },
        cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-800' }
    }[appointment.status as string] || { label: 'ไม่ระบุ', color: 'bg-gray-100' };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        return format(parseISO(dateStr), 'dd MMM yyyy', { locale: th });
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
            {/* Header: Customer & Status */}
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg text-gray-900 truncate">{appointment.customerInfo?.fullName || appointment.customerInfo?.name || 'ลูกค้าทั่วไป'}</p>
                    <p className="text-sm text-gray-500">{appointment.customerInfo?.phone}</p>
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

            {/* Booking Details */}
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                {isRoomBooking ? (
                    <>
                        <p className="font-semibold text-gray-800">{appointment.roomTypeInfo?.name || 'ไม่ระบุประเภทห้อง'}</p>
                        <div className="text-sm text-gray-600 space-y-1">
                            {appointment.bookingInfo?.roomId && (
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400">🚪</span>
                                    <span>ห้อง {appointment.bookingInfo.roomId}</span>
                                    {/* Note: roomId might be an ID, typically we want Room Number, but usually Room Data is not joined here unless passed. 
                                        If roomId is just ID, we might not show it or show "Assign Room". 
                                        Actually bookingInfo might have 'roomNumber' if we stored it. 
                                        If not, just showing Dates is safer. */}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">เข้าพัก:</span>
                                <span className="font-medium">{formatDate(appointment.bookingInfo?.checkInDate)}</span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium">{formatDate(appointment.bookingInfo?.checkOutDate)}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                                {appointment.bookingInfo?.nights || 1} คืน, {appointment.bookingInfo?.rooms || 1} ห้อง, {appointment.bookingInfo?.guests || 1} ท่าน
                            </div>
                        </div>
                    </>
                ) : (
                    // Fallback for Service (if any)
                    <>
                        <p className="font-semibold text-gray-800">{appointment.serviceInfo?.name}</p>
                        <div className="text-sm text-gray-600">
                            {appointment.date && <span>{formatDate(appointment.date)} {appointment.time} น.</span>}
                        </div>
                    </>
                )}
            </div>

            {/* Price */}
            <div className="flex items-center justify-between text-sm">
                <div className="text-gray-600">
                    {/* Extra info if needed */}
                </div>
                <span className="font-bold text-gray-900">{appointment.paymentInfo?.totalPrice?.toLocaleString()} {profile.currencySymbol || '฿'}</span>
            </div>

            {/* Check-in Message & Action */}
            <div className="border-t pt-3">
                {checkInStatus.text && (
                    <p className={`text-center font-semibold mb-2 text-sm ${checkInStatus.color}`}>{checkInStatus.text}</p>
                )}
                <button
                    onClick={() => onManage(appointment)}
                    className="w-full font-bold py-3 rounded-xl transition-colors bg-gray-900 text-white hover:bg-gray-800"
                >
                    จัดการการจอง
                </button>
            </div>
        </div>
    );
};

export default AppointmentCard;
