"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

interface AppointmentCardProps {
    job: Appointment;
    onQrCodeClick: (id: string) => void;
    onCancelClick: (appointment: Appointment) => void;
}

const statusConfig: Record<string, { text: string; bg: string; dot: string }> = {
    awaiting_confirmation: { text: 'รอชำระเงิน', bg: 'bg-orange-50 text-orange-600', dot: 'bg-orange-400' },
    pending: { text: 'รอตรวจสอบ', bg: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
    confirmed: { text: 'ชำระเงินแล้ว', bg: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
    in_progress: { text: 'กำลังเข้าพัก', bg: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
    completed: { text: 'เสร็จสิ้น', bg: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
    cancelled: { text: 'ยกเลิก', bg: 'bg-red-50 text-red-500', dot: 'bg-red-400' },
};

const AppointmentCard: React.FC<AppointmentCardProps> = ({ job, onQrCodeClick, onCancelClick }) => {
    const { profile } = useProfile();

    const status = statusConfig[job.status] || { text: job.status, bg: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' };
    const isRoom = job.bookingType === 'room';
    const title = isRoom ? (job.roomTypeInfo?.name || 'Room Booking') : (job.serviceInfo?.name || 'Service Booking');
    const imageUrl = isRoom ? job.roomTypeInfo?.imageUrl : null;
    const price = job.paymentInfo?.totalPrice?.toLocaleString() || '-';
    const currencySymbol = profile?.currencySymbol || 'บาท';

    // Date/Duration info
    let dateLabel = '';
    let durationLabel = '';
    let checkinLabel = '';

    if (isRoom && job.bookingInfo?.checkInDate && job.bookingInfo?.checkOutDate) {
        const checkIn = new Date(job.bookingInfo.checkInDate);
        const checkOut = new Date(job.bookingInfo.checkOutDate);
        const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        dateLabel = `${format(checkIn, 'd-', { locale: th })}${format(checkOut, 'd MMMM yyyy', { locale: th })}`;
        durationLabel = `วันเข้าพัก ${nights} คืน`;
        checkinLabel = format(checkIn, 'dd/MM/yyyy');
        const guests = job.bookingInfo?.guests ?? 1;
        durationLabel += `  เข้าพัก ${guests} คน`;
    } else if (job.appointmentInfo?.dateTime) {
        const dt = typeof job.appointmentInfo.dateTime.toDate === 'function'
            ? job.appointmentInfo.dateTime.toDate()
            : new Date(job.appointmentInfo.dateTime);
        dateLabel = format(dt, 'd MMMM yyyy', { locale: th });
        checkinLabel = format(dt, 'dd/MM/yyyy');
    }

    const isActionable = ['pending', 'awaiting_confirmation', 'confirmed'].includes(job.status);

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-4">
            {/* Room Image */}
            <div className="relative w-full h-44 bg-gray-100 overflow-hidden">
                {imageUrl ? (
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Title */}
                <div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{title}</h3>
                    {isRoom && job.roomTypeInfo?.category && (
                        <p className="text-xs text-gray-400 font-medium mt-0.5">{job.roomTypeInfo.category}</p>
                    )}
                </div>

                {/* Date & Duration */}
                {dateLabel && (
                    <div className="text-sm text-gray-700 font-medium">{dateLabel}</div>
                )}
                {durationLabel && (
                    <div className="text-sm text-gray-500">{durationLabel}</div>
                )}

                {/* Price Row */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ราคาสุทธิ</p>
                        <p className="text-[10px] text-gray-400">
                            {job.paymentInfo?.discount && job.paymentInfo.discount > 0 ? 'หักส่วนลดแล้ว' : 'รวมทุกอย่าง'}
                        </p>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">
                        {price} <span className="text-sm font-normal text-gray-500">{currencySymbol}</span>
                    </span>
                </div>

                {/* Status + Check-in Row */}
                <div className="flex gap-2">
                    {/* Status pill */}
                    <div className={`flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5 border border-gray-100 ${status.bg} bg-opacity-60`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`}></span>
                        <span className="text-xs font-bold">สถานะ:</span>
                        <span className="text-xs font-semibold">{status.text}</span>
                    </div>

                    {/* Check-in date */}
                    {isActionable && (
                        <button
                            onClick={() => onQrCodeClick(job.id!)}
                            className="flex items-center gap-2 bg-[#1A1A1A] text-white rounded-xl px-3 py-2.5 text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <div className="text-left">
                                <p className="text-[9px] opacity-70 leading-none">Check in</p>
                                <p className="text-xs font-bold leading-tight">{checkinLabel || '-'}</p>
                            </div>
                        </button>
                    )}
                </div>

                {/* Cancel button (subtle) */}
                {isActionable && job.status !== 'in_progress' && (
                    <button
                        onClick={() => onCancelClick(job)}
                        className="w-full text-center text-xs text-gray-400 hover:text-red-500 transition-colors py-1 font-medium"
                    >
                        ยกเลิกการจอง
                    </button>
                )}
            </div>
        </div>
    );
};

export default AppointmentCard;
