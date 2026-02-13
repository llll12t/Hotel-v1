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

const StarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-400">
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
);

const AppointmentCard: React.FC<AppointmentCardProps> = ({ job, onQrCodeClick, onCancelClick }) => {
    // Status Logic
    const statusConfig: Record<string, { text: string; className: string }> = {
        awaiting_confirmation: { text: 'รอชำระเงิน', className: 'bg-orange-500 text-white' },
        pending: { text: 'รอตรวจสอบ', className: 'bg-yellow-500 text-white' },
        confirmed: { text: 'Confirmed', className: 'bg-green-500 text-white' },
        in_progress: { text: 'Check-in', className: 'bg-blue-500 text-white' },
        completed: { text: 'Completed', className: 'bg-gray-500 text-white' },
        cancelled: { text: 'Cancelled', className: 'bg-red-500 text-white' },
    };
    const status = statusConfig[job.status] || { text: job.status, className: 'bg-gray-500 text-white' };

    // Data Extraction
    const isRoom = job.bookingType === 'room';
    const title = isRoom ? (job.roomTypeInfo?.name || 'Room Booking') : (job.serviceInfo?.name || 'Service Booking');
    const imageUrl = isRoom ? job.roomTypeInfo?.imageUrl : null;

    // Dates
    let dateDisplay = '';
    if (isRoom && job.bookingInfo?.checkInDate && job.bookingInfo?.checkOutDate) {
        const checkIn = new Date(job.bookingInfo.checkInDate);
        const checkOut = new Date(job.bookingInfo.checkOutDate);
        dateDisplay = `${format(checkIn, 'd MMM', { locale: th })} - ${format(checkOut, 'd MMM', { locale: th })}`;
    } else if (job.appointmentInfo?.dateTime) {
        const date = typeof job.appointmentInfo.dateTime.toDate === 'function' ? job.appointmentInfo.dateTime.toDate() : new Date(job.appointmentInfo.dateTime);
        dateDisplay = format(date, 'd MMM HH:mm', { locale: th });
    }

    const price = job.paymentInfo?.totalPrice?.toLocaleString() || '-';
    // Mock rating for UI match (or real if available in future)
    const rating = 4.9;
    const reviews = 10;

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_4px_12px_-2px_rgba(0,0,0,0.02)] hover:shadow-lg transition-all duration-300 mb-4 group border border-gray-100/80">
            {/* Image Area - More Compact */}
            <div className="relative w-full h-40 bg-gray-100 overflow-hidden">
                {imageUrl ? (
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                        <span className="text-xl font-bold">3RN</span>
                    </div>
                )}

                {/* Status Badge */}
                <div className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md bg-opacity-90 ${status.className}`}>
                    {status.text}
                </div>
            </div>

            {/* Content Area - Compact */}
            <div className="p-4">
                {/* Title & Price Row */}
                <div className="flex justify-between items-start mb-1">
                    <h3 className="text-lg font-bold text-gray-900 leading-tight line-clamp-1">{title}</h3>
                    <div className="text-right whitespace-nowrap ml-3">
                        <span className="text-base font-bold text-gray-900">{price}</span>
                        <span className="text-[10px] text-gray-500 font-normal ml-0.5">บาท</span>
                    </div>
                </div>

                {/* Subtitle & Rating Row */}
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white bg-black px-1.5 py-0.5 rounded">{isRoom ? 'Room' : 'Service'}</span>
                        {/* Date */}
                        <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-gray-400">
                                <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5 .75.75 0 0 0 0 1.5Z" />
                                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                            </svg>
                            {dateDisplay}
                        </p>
                    </div>

                    <div className="flex items-center gap-1">
                        <StarIcon />
                        <span className="text-xs font-bold text-gray-900">{rating}</span>
                        <span className="text-[10px] text-gray-400">({reviews})</span>
                    </div>
                </div>

                {/* Actions (Only visible if action needed) */}
                {['pending', 'awaiting_confirmation', 'confirmed'].includes(job.status) && (
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-gray-50">
                        <button
                            onClick={() => onCancelClick(job)}
                            className="py-2 rounded-xl text-gray-500 text-xs font-semibold hover:bg-gray-50 transition-colors border border-gray-100"
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={() => onQrCodeClick(job.id!)}
                            className="py-2 rounded-xl bg-black text-white text-xs font-bold shadow-md hover:opacity-90 transition-colors active:scale-95"
                        >
                            {job.status === 'confirmed' ? 'QR Code' : 'ชำระเงิน'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppointmentCard;
