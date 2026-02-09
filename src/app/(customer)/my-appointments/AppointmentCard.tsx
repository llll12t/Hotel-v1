"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

// ไอคอนดอกไม้สปา
const SpaFlowerIcon = ({ className = "w-10 h-10", color = "#ffffff", ...props }) => (
    <svg className={className} fill={color} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M512,255.992c0-37.331-22.112-69.445-53.84-83.734c12.329-32.557,5.243-70.893-21.149-97.286c-26.376-26.376-64.704-33.461-97.261-21.124C325.445,22.112,293.331,0,256.009,0c-37.323,0-69.445,22.112-83.76,53.848c-32.54-12.337-70.876-5.252-97.252,21.124c-26.393,26.393-33.478,64.729-21.149,97.286C22.121,186.564,0,218.677,0,255.992c0,37.314,22.121,69.444,53.849,83.75c-12.329,32.557-5.244,70.886,21.132,97.27c26.393,26.384,64.729,33.47,97.269,21.14C186.556,489.888,218.661,512,255.992,512c37.339,0,69.469-22.112,83.758-53.848c32.557,12.329,70.885,5.243,97.261-21.14c26.392-26.384,33.478-64.712,21.149-97.27C489.888,325.453,512,293.34,512,255.992z M248.529,125.571c1.717-1.566,3.401-3.174,5.025-4.841c1.709,1.575,3.476,3.108,5.269,4.623c12.69,11.651,9.347,23.252-0.67,48.706c-0.787,2.027-1.893,4.69-3.3,7.882c-1.49-3.132-2.731-5.754-3.601-7.772C240.195,149.191,236.334,137.742,248.529,125.571z M158.094,162.626c2.329-0.068,4.649-0.218,6.969-0.428c17.213-0.728,23.034,9.859,33.94,34.903c0.854,1.977,1.993,4.682,3.25,7.89c-3.283-1.13-6.014-2.127-8.024-2.907c-25.487-9.858-36.301-15.219-36.301-32.448C158.028,167.283,158.094,164.954,158.094,162.626z M125.572,263.48c-1.567-1.725-3.175-3.417-4.833-5.034c1.574-1.717,3.099-3.484,4.623-5.285c11.651-12.672,23.252-9.322,48.689,0.712c2.019,0.788,4.707,1.893,7.856,3.283c-3.099,1.499-5.746,2.706-7.731,3.602C149.2,271.814,137.724,275.642,125.572,263.48z M202.119,317.772c-9.884,25.488-15.253,36.301-32.482,36.293c-2.337-0.084-4.682-0.16-7.003-0.16c-0.067-2.32-0.217-4.649-0.418-6.96c-0.737-17.221,9.85-23.059,34.894-33.939c2.01-0.88,4.707-2.002,7.923-3.292C203.91,312.998,202.906,315.754,202.119,317.772z M263.48,386.429c-1.726,1.558-3.401,3.174-5.026,4.842c-1.708-1.575-3.484-3.107-5.276-4.624c-12.681-11.66-9.331-23.26,0.67-48.706c0.788-2.01,1.91-4.724,3.309-7.907c1.499,3.132,2.721,5.788,3.601,7.79C271.814,362.809,275.675,374.251,263.48,386.429z M256.009,289.328c-18.41,0-33.337-14.917-33.337-33.327c0-18.419,14.926-33.336,33.337-33.336c18.409,0,33.327,14.917,33.327,33.336C289.336,274.411,274.418,289.328,256.009,289.328z M309.891,194.236c9.892-25.504,15.252-36.318,32.473-36.309c2.346,0.092,4.691,0.167,7.02,0.167c0.05,2.329,0.2,4.64,0.418,6.969c0.729,17.204-9.858,23.026-34.902,33.922c-2.01,0.896-4.699,1.986-7.916,3.275C308.107,198.969,309.095,196.256,309.891,194.236z M353.914,349.366c-2.32,0.067-4.649,0.226-6.969,0.436c-17.212,0.72-23.026-9.858-33.931-34.91c-0.888-2.01-2.001-4.716-3.291-7.932c3.283,1.13,6.022,2.136,8.048,2.932c25.505,9.858,36.31,15.244,36.31,32.464C353.981,344.709,353.914,347.037,353.914,349.366z M386.647,258.823c-11.651,12.681-23.26,9.338-48.688-0.696c-2.028-0.788-4.708-1.902-7.882-3.292c3.125-1.499,5.754-2.738,7.765-3.601c24.968-11.057,36.443-14.892,48.588-2.714c1.566,1.726,3.183,3.41,4.842,5.025C389.696,255.263,388.171,257.03,386.647,258.823z" />
    </svg>
);

interface AppointmentCardProps {
    job: Appointment;
    onQrCodeClick: (id: string) => void;
    onCancelClick: (appointment: Appointment) => void;
    onConfirmClick: (appointment: Appointment) => void;
    isConfirming: boolean;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ job, onQrCodeClick, onCancelClick, onConfirmClick, isConfirming }) => {
    const { profile } = useProfile();
    const statusInfo = {
        'awaiting_confirmation': { text: 'รอยืนยัน' },
        'confirmed': { text: 'ยืนยันแล้ว' },
        'in_progress': { text: 'กำลังใช้บริการ' },
        'pending': { text: 'จอง' },
        'completed': { text: 'เสร็จสิ้น' },
        'cancelled': { text: 'ยกเลิก' },
    }[job.status] || { text: job.status };

    // Convert potentially any timestamp to date
    const appointmentDateTime = job.appointmentInfo.dateTime && typeof job.appointmentInfo.dateTime.toDate === 'function'
        ? job.appointmentInfo.dateTime.toDate()
        : new Date(job.appointmentInfo.dateTime);

    const addOns = job.appointmentInfo?.addOns || [];

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            {/* Header with flower decoration */}
            <div className="bg-[#5D4037] p-4 text-[#F5F2ED] relative overflow-hidden">
                {/* ลายดอกไม้ตกแต่ง */}
                <div className="absolute top-[-15px] right-[-15px] opacity-10 pointer-events-none">
                    <SpaFlowerIcon className="w-20 h-20" />
                </div>
                <div className="absolute bottom-[-10px] left-[-10px] opacity-10 pointer-events-none transform rotate-45">
                    <SpaFlowerIcon className="w-12 h-12" />
                </div>

                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <div className="text-sm opacity-90">นัดหมายบริการ</div>
                        <div className="font-semibold">{format(appointmentDateTime, 'd MMMM yyyy, HH:mm น.', { locale: th })}</div>
                    </div>
                    <div className="text-sm font-semibold">{statusInfo.text}</div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6">
                <div className="flex justify-between items-start text-sm mb-2">
                    <div className="flex-1">
                        <span className="font-semibold text-gray-800 block">{job.serviceInfo?.name}</span>

                        {/* Multi-area service details */}
                        {job.serviceInfo?.serviceType === 'multi-area' && (
                            <div className="mt-1 space-y-0.5">
                                {job.serviceInfo?.selectedArea && (
                                    <div className="text-xs text-[#5D4037] font-medium">
                                        {job.serviceInfo.selectedArea.name}
                                    </div>
                                )}
                                {job.serviceInfo?.selectedPackage && (
                                    <div className="text-xs text-[#5D4037]">
                                        {job.serviceInfo.selectedPackage.name && <span className="font-bold">{job.serviceInfo.selectedPackage.name} </span>}
                                        ({job.serviceInfo.selectedPackage.duration} นาที)
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Option-based service details */}
                        {job.serviceInfo?.serviceType === 'option-based' && (
                            <div className="mt-1 space-y-0.5">
                                {job.serviceInfo?.selectedOptionName && (
                                    <div className="text-xs text-[#5D4037] font-medium">
                                        {job.serviceInfo.selectedOptionName}
                                        {job.serviceInfo.selectedOptionPrice && (
                                            <span className="text-gray-500 font-normal"> (@ {Number(job.serviceInfo.selectedOptionPrice).toLocaleString()} {profile?.currencySymbol})</span>
                                        )}
                                        {job.serviceInfo.selectedAreas && job.serviceInfo.selectedAreas.length > 0 && (
                                            <span className="text-gray-500 font-normal"> x {job.serviceInfo.selectedAreas.length} จุด</span>
                                        )}
                                    </div>
                                )}
                                {job.serviceInfo?.selectedAreas && job.serviceInfo.selectedAreas.length > 0 && (
                                    <div className="text-xs text-gray-500">
                                        ({job.serviceInfo.selectedAreas.join(', ')})
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Area-based-options service details */}
                        {job.serviceInfo?.serviceType === 'area-based-options' && job.serviceInfo?.selectedAreaOptions && job.serviceInfo.selectedAreaOptions.length > 0 && (
                            <div className="mt-1 space-y-1">
                                {job.serviceInfo.selectedAreaOptions.map((opt, idx) => (
                                    <div key={idx} className="text-xs text-gray-600 flex justify-between">
                                        <span>{opt.areaName} ({opt.optionName})</span>
                                        {opt.price && <span>{Number(opt.price).toLocaleString()} {profile?.currencySymbol}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <span className="text-gray-700 ml-2 font-medium">{job.paymentInfo?.basePrice?.toLocaleString()} {profile?.currencySymbol}</span>
                </div>

                {/* Add-on Services */}
                {addOns.length > 0 && (
                    <div className="space-y-1 text-sm text-[#5D4037] mb-3 pl-4 border-l-2 border-[#5D4037]/20">
                        {addOns.map((addon, index) => (
                            <div key={index} className="flex justify-between">
                                <span>+ {addon.name}</span>
                                <span>{addon.price?.toLocaleString()} {profile?.currencySymbol}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Total Price */}
                <div className="pt-3 mb-4 border-t border-gray-100 mt-2">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-[#5D4037]">ราคารวม</span>
                        <span className="font-bold text-lg text-[#5D4037]">{job.paymentInfo?.totalPrice?.toLocaleString() || 'N/A'} {profile?.currencySymbol}</span>
                    </div>
                    {job.paymentInfo?.discount && job.paymentInfo.discount > 0 ? (
                        <div className="flex justify-between items-center text-xs text-green-600 mt-1">
                            <span>ส่วนลด</span>
                            <span>-{job.paymentInfo.discount.toLocaleString()} {profile?.currencySymbol}</span>
                        </div>
                    ) : null}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                    <button
                        onClick={() => job.id && onQrCodeClick(job.id)}
                        className="bg-white text-gray-700 border border-gray-200 py-2 px-4 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        QR Code
                    </button>
                    <div className="flex space-x-2">
                        {job.status === 'awaiting_confirmation' && (
                            <button
                                onClick={() => onConfirmClick(job)}
                                disabled={isConfirming}
                                className="bg-[#5D4037] text-white py-2 px-4 rounded-xl font-semibold text-sm hover:bg-[#3E2723] transition-colors disabled:bg-gray-300"
                            >
                                {isConfirming ? '...' : 'ยืนยัน'}
                            </button>
                        )}
                        {job.status === 'confirmed' && (
                            <div className="text-center text-green-600 font-medium text-xs py-2 bg-green-50 px-3 rounded-lg">
                                กรุณามาก่อน 10 นาที
                            </div>
                        )}
                        {job.status !== 'in_progress' && job.status !== 'confirmed' && (
                            <button
                                onClick={() => onCancelClick(job)}
                                className="bg-red-50 text-red-600 py-2 px-4 rounded-xl font-semibold text-sm hover:bg-red-100 transition-colors border border-red-100"
                            >
                                ยกเลิก
                            </button>
                        )}
                        {job.status === 'confirmed' && (
                            <button
                                onClick={() => onCancelClick(job)}
                                className="text-red-500 text-xs hover:text-red-700 underline px-2"
                            >
                                ยกเลิก
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppointmentCard;
