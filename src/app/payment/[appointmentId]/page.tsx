"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';

export default function PaymentPage() {
    const params = useParams();
    const appointmentId = params?.appointmentId as string;
    const [appointment, setAppointment] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [paymentSettings, setPaymentSettings] = useState<any | null>(null);

    useEffect(() => {
        const fetchAppointmentAndSettings = async () => {
            if (!appointmentId) {
                setError('ไม่พบรหัสการนัดหมาย');
                setLoading(false);
                return;
            }

            try {
                // Fetch Payment Settings first
                const paymentRef = doc(db, 'settings', 'payment');
                const paymentSnap = await getDoc(paymentRef);
                if (!paymentSnap.exists()) {
                    throw new Error("ไม่พบการตั้งค่าการชำระเงินของร้านค้า");
                }
                const settings = paymentSnap.data();
                setPaymentSettings(settings);

                // Fetch Appointment
                const appointmentRef = doc(db, 'appointments', appointmentId);
                const appointmentSnap = await getDoc(appointmentRef);
                if (!appointmentSnap.exists()) {
                    throw new Error("ไม่พบข้อมูลการนัดหมาย");
                }
                const appointmentData = { id: appointmentSnap.id, ...appointmentSnap.data() };
                setAppointment(appointmentData);

                // Generate QR Code based on settings
                if (settings.method === 'image') {
                    if (!settings.qrCodeImageUrl) {
                        throw new Error("ร้านค้ายังไม่ได้ตั้งค่ารูปภาพ QR Code");
                    }
                    setQrCodeDataUrl(settings.qrCodeImageUrl);
                } else if (settings.method === 'promptpay') {
                    const amount = parseFloat(appointmentData.paymentInfo?.totalPrice);
                    if (isNaN(amount) || amount <= 0) {
                        throw new Error("ยอดชำระของรายการนี้ไม่ถูกต้อง");
                    }
                    if (!settings.promptPayAccount) {
                        throw new Error("ร้านค้ายังไม่ได้ตั้งค่าบัญชี PromptPay");
                    }
                    const payload = generatePayload(settings.promptPayAccount, { amount });
                    const qrCodeUrl = await QRCode.toDataURL(payload, { width: 300 });
                    setQrCodeDataUrl(qrCodeUrl);
                } else if (settings.method === 'bankinfo') {
                    if (!settings.bankInfoText) {
                        throw new Error("ร้านค้ายังไม่ได้ตั้งค่าข้อมูลบัญชีธนาคาร");
                    }
                    // ไม่ต้องสร้าง QR Code สำหรับ bankinfo
                } else {
                    throw new Error("รูปแบบการชำระเงินที่ร้านค้าตั้งค่าไว้ไม่ถูกต้อง");
                }

            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointmentAndSettings();
    }, [appointmentId]);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-[#FAF9F6]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-500 font-light">กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#FAF9F6] p-6 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
                    <div className="text-red-500 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>
                    </div>
                    <div className="text-gray-900 text-lg font-semibold mb-2">เกิดข้อผิดพลาด</div>
                    <p className="text-gray-600 mb-6">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-[340px] bg-white rounded-3xl p-6 text-center shadow-sm">

                {/* Header & Price */}
                <div className="mb-6">
                    <h1 className="text-lg font-bold text-gray-900 mb-0.5">ชำระค่าบริการ</h1>
                    <p className="text-xs text-gray-500 mb-4">{appointment?.serviceInfo?.name}</p>

                    <div className="inline-flex items-baseline justify-center gap-1.5 bg-primary/5 px-5 py-2.5 rounded-2xl">
                        <span className="text-3xl font-bold text-primary tracking-tight">
                            {appointment?.paymentInfo?.totalPrice?.toLocaleString()}
                        </span>
                        <span className="text-sm font-medium text-gray-500">THB</span>
                    </div>
                </div>

                {/* QR Section */}
                <div className="mb-4">
                    {paymentSettings?.method === 'bankinfo' ? (
                        <div className="bg-gray-50 rounded-xl p-4 text-left">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200/50">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <span className="font-semibold text-xs text-gray-700">บัญชีธนาคาร</span>
                            </div>
                            <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed text-sm">
                                {paymentSettings.bankInfoText}
                            </pre>
                        </div>
                    ) : qrCodeDataUrl ? (
                        <div className="flex flex-col items-center">
                            {/* QR Image - No Border, Just Image */}
                            <div className="mb-3">
                                <img src={qrCodeDataUrl} alt="QR Code" className="w-[180px] h-[180px] object-contain mix-blend-multiply" />
                            </div>

                            {/* PromptPay Number - Minimal Chip */}
                            {paymentSettings?.method === 'promptpay' && (
                                <div className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                                    <span className="text-xs font-mono text-gray-600 tracking-wide">
                                        {paymentSettings.promptPayAccount}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
                            <p className="font-semibold">ไม่สามารถสร้าง QR Code ได้</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-dashed border-gray-100">
                    <p className="text-[10px] text-gray-400 font-light">
                        เมื่อชำระเงินเรียบร้อยแล้ว<br />
                        <span className="text-gray-500 font-normal">กรุณาส่งสลิปหลักฐานผ่านทาง LINE OA</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
