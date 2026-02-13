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

const AppointmentCard: React.FC<AppointmentCardProps> = ({ job, onQrCodeClick, onCancelClick }) => {
    const { profile } = useProfile();

    // Status Logic
    const statusConfig: Record<string, { text: string; className: string }> = {
        awaiting_confirmation: { text: 'รอชำระเงิน', className: 'bg-orange-100 text-orange-600' },
        pending: { text: 'รอตรวจสอบ', className: 'bg-yellow-100 text-yellow-600' },
        confirmed: { text: 'จองสำเร็จ', className: 'bg-green-100 text-green-600' },
        in_progress: { text: 'กำลังเข้าพัก', className: 'bg-blue-100 text-blue-600' },
        completed: { text: 'เสร็จสิ้น', className: 'bg-gray-100 text-gray-500' },
        cancelled: { text: 'ยกเลิก', className: 'bg-red-100 text-red-500' },
        blocked: { text: 'ไม่ว่าง', className: 'bg-gray-200 text-gray-500' },
    };
    const status = statusConfig[job.status] || { text: job.status, className: 'bg-gray-100 text-gray-500' };

    // Data Extraction
    const isRoom = job.bookingType === 'room';

    // Title
    const title = isRoom
        ? (job.roomTypeInfo?.name || 'Room Booking')
        : (job.serviceInfo?.name || 'Service Booking');

    // Image
    const imageUrl = isRoom
        ? job.roomTypeInfo?.imageUrl
        : null;

    // Dates
    let dateDisplay = '';
    if (isRoom && job.bookingInfo?.checkInDate && job.bookingInfo?.checkOutDate) {
        const checkIn = new Date(job.bookingInfo.checkInDate);
        const checkOut = new Date(job.bookingInfo.checkOutDate);
        dateDisplay = `${format(checkIn, 'd MMM', { locale: th })} - ${format(checkOut, 'd MMM yyyy', { locale: th })}`;
    } else if (job.appointmentInfo?.dateTime) {
        // Service Date
        const date = typeof job.appointmentInfo.dateTime.toDate === 'function'
            ? job.appointmentInfo.dateTime.toDate()
            : new Date(job.appointmentInfo.dateTime);
        dateDisplay = format(date, 'd MMM yyyy, HH:mm น.', { locale: th });
    }

    // Price
    const price = job.paymentInfo?.totalPrice?.toLocaleString() || '-';

    return (
        <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all group mb-4">
            <div className="flex flex-col sm:flex-row">
                {/* Image Section */}
                <div className="relative w-full sm:w-1/3 aspect-[16/9] sm:aspect-auto bg-gray-100">
                    {imageUrl ? (
                        <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <span className="text-4xl text-gray-200 font-bold">3RN</span>
                        </div>
                    )}
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold shadow-sm ${status.className}`}>
                        {status.text}
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 p-4 flex flex-col justify-between min-h-[140px]">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 pr-2">
                                <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{title}</h3>
                                <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5" />
                                    </svg>
                                    {dateDisplay}
                                </p>
                                {isRoom && job.bookingInfo?.guests && (
                                    <p className="text-xs text-gray-400 mt-1 ml-5">
                                        {job.bookingInfo.guests} Guests • {job.bookingInfo.nights} Nights
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-bold text-gray-900">{price}</span>
                                <span className="text-xs text-gray-500 ml-1">บาท</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-50">
                        {/* Cancel Button */}
                        {['pending', 'awaiting_confirmation', 'confirmed'].includes(job.status) && (
                            <button
                                onClick={() => onCancelClick(job)}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                            >
                                ยกเลิก
                            </button>
                        )}

                        {/* QR Code / Payment Button */}
                        {['pending', 'awaiting_confirmation', 'confirmed'].includes(job.status) && (
                            <button
                                onClick={() => onQrCodeClick(job.id!)}
                                className="px-4 py-2 bg-black text-white text-sm font-bold rounded-xl shadow-sm hover:opacity-90 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
                                </svg>
                                {job.status === 'confirmed' ? 'QR Code' : 'ชำระเงิน'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppointmentCard;
