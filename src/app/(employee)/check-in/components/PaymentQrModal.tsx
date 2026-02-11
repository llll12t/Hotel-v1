
import { useState, useEffect } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode'; // Check if this should be 'qrcode' or server-side? It's client side here.
import generatePayload from 'promptpay-qr';
import { getPaymentSettings } from '@/app/actions/settingsActions';
import { useLiffContext } from '@/context/LiffProvider';
import { Appointment } from '@/types';

interface PaymentQrModalProps {
    show: boolean;
    onClose: () => void;
    appointment: Appointment;
    profile: any;
}

const PaymentQrModal = ({ show, onClose, appointment, profile }: PaymentQrModalProps) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { liff } = useLiffContext();

    useEffect(() => {
        if (show && appointment) {
            const generateQR = async () => {
                setLoading(true);
                setError('');
                setQrCodeUrl('');
                try {
                    const lineAccessToken = liff?.getAccessToken?.();
                    const settingsResult = await getPaymentSettings({ lineAccessToken });
                    if (!settingsResult.success || !settingsResult.settings) throw new Error(settingsResult.error || "ไม่พบการตั้งค่าการชำระเงิน");

                    const settings: any = settingsResult.settings;
                    if (settings.method === 'image') {
                        if (!settings.qrCodeImageUrl) throw new Error("แอดมินยังไม่ได้ตั้งค่ารูปภาพ QR Code");
                        setQrCodeUrl(settings.qrCodeImageUrl);
                    } else if (settings.method === 'promptpay') {
                        if (!settings.promptPayAccount) throw new Error("แอดมินยังไม่ได้ตั้งค่าบัญชี PromptPay");
                        const amount = appointment.paymentInfo?.totalPrice || 0;
                        const payload = generatePayload(settings.promptPayAccount, { amount });
                        const url = await QRCode.toDataURL(payload);
                        setQrCodeUrl(url);
                    } else {
                        throw new Error("รูปแบบการชำระเงินไม่ถูกต้อง");
                    }
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            generateQR();
        }
    }, [show, appointment]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-1 text-gray-900">Scan to Pay</h2>
                <p className="text-2xl font-bold text-gray-900 mb-3">{appointment.paymentInfo?.totalPrice?.toLocaleString()} {profile.currencySymbol}</p>
                <div className="h-64 w-64 mx-auto flex items-center justify-center">
                    {loading ? <p>กำลังสร้าง QR Code...</p> :
                        error ? <p className="text-red-500 text-sm">{error}</p> :
                            qrCodeUrl && <Image src={qrCodeUrl} alt="Payment QR Code" width={256} height={256} style={{ objectFit: 'contain' }} unoptimized />}
                </div>
                <button onClick={onClose} className="mt-4 w-full bg-gray-900 text-white py-2 rounded-xl font-semibold hover:bg-gray-800">ปิด</button>
            </div>
        </div>
    );
};

export default PaymentQrModal;
