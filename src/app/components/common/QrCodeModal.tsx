"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { generateQrCodeFromText } from '@/app/actions/paymentActions';

interface QrCodeModalProps {
    show: boolean;
    onClose: () => void;
    appointmentId: string | null;
}

const QrCodeModal: React.FC<QrCodeModalProps> = ({ show, onClose, appointmentId }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && appointmentId) {
            const generateQR = async () => {
                setLoading(true);
                try {
                    const url = await generateQrCodeFromText(appointmentId);
                    setQrCodeUrl(url);
                } catch (error) {
                    console.error("Error generating QR code:", error);
                } finally {
                    setLoading(false);
                }
            };
            generateQR();
        }
    }, [show, appointmentId]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-2 text-gray-800">Appointment QR Code</h2>
                <p className="text-sm text-gray-500 mb-4">แสดง QR Code นี้ให้ช่างเสริมสวย</p>
                {loading ? (
                    <div className="h-48 flex items-center justify-center"><p className="text-gray-500">กำลังสร้าง QR Code...</p></div>
                ) : (
                    <div className="flex justify-center h-64 relative w-full">
                        {qrCodeUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={qrCodeUrl} alt="Appointment QR Code" className="w-full h-full object-contain" />
                        )}
                    </div>
                )}
                <button
                    onClick={onClose}
                    className="mt-4 w-full bg-[#ff7a3d] hover:bg-[#ff6a24] text-white py-2.5 rounded-2xl font-semibold transition-colors shadow-sm"
                >
                    ปิด
                </button>
            </div>
        </div>
    );
};

export default QrCodeModal;
