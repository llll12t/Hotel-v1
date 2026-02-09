
"use client";

import { useState } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { findAppointmentsByPhone, findAppointmentById } from '@/app/actions/employeeActions';
import EmployeeHeader from '@/app/components/EmployeeHeader';
import { useToast } from '@/app/components/Toast';
import { Appointment } from '@/types';
import { useRouter } from 'next/navigation';
import AppointmentCard from './components/AppointmentCard';

// --- หน้าหลัก ---
export default function CheckInPage() {
    const { liff, profile, loading: liffLoading } = useLiffContext();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const router = useRouter();
    const { showToast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber) return;
        const sanitizedPhoneNumber = phoneNumber.replace(/[\s-()]/g, '');
        setLoading(true);
        setMessage('');
        setAppointments([]);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await findAppointmentsByPhone(sanitizedPhoneNumber, { lineAccessToken });
        if (result.success) {
            if (result.appointments.length > 0) {
                setAppointments(result.appointments);
            } else {
                setMessage('ไม่พบการนัดหมายสำหรับเบอร์โทรนี้');
            }
        } else {
            setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
        }
        setLoading(false);
    };

    const handleScan = async () => {
        if (!liff || !liff.isInClient()) {
            showToast('ฟังก์ชันสแกน QR ใช้งานได้บน LINE เท่านั้น', 'error');
            return;
        }
        try {
            const result = await liff.scanCodeV2();
            if (result && result.value) {
                setLoading(true);
                setMessage('กำลังค้นหาข้อมูล...');
                const lineAccessToken = liff?.getAccessToken?.();
                const searchResult = await findAppointmentById(result.value, { lineAccessToken });
                if (searchResult.success) {
                    setAppointments([searchResult.appointment]);
                    setMessage('');
                } else {
                    setMessage(`ไม่พบข้อมูล: ${searchResult.error}`);
                }
                setLoading(false);
            }
        } catch (error: any) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถสแกน QR Code ได้'}`);
        }
    };

    const handleOpenModal = (appointment: Appointment) => {
        router.push(`/check-in/${appointment.id}`);
    };



    return (
        <div className="min-h-screen bg-gray-100">
            <EmployeeHeader />

            <div className="max-w-md mx-auto p-4 space-y-6">
                {/* Search Card */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">ค้นหานัดหมาย</h2>
                    <form onSubmit={handleSearch}>
                        <label className="block text-sm font-medium text-gray-600 mb-2">เบอร์โทรศัพท์ลูกค้า</label>
                        <div className="flex space-x-2">
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="0XX-XXX-XXXX"
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                            />
                            <button
                                type="submit"
                                className="px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                                disabled={loading}
                            >
                                {loading ? '...' : 'ค้นหา'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="text-sm text-gray-400 font-medium">หรือ</span>
                    <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                {/* QR Scan Button */}
                <button
                    onClick={handleScan}
                    className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 disabled:bg-gray-400 transition-colors shadow-md flex items-center justify-center gap-2"
                    disabled={liffLoading || loading}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    สแกน QR Code
                </button>

                {/* Results Section */}
                <div className="space-y-4">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    )}
                    {message && (
                        <div className="text-center text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
                            {message}
                        </div>
                    )}
                    {appointments.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">ผลการค้นหา</h3>
                            {appointments.map(app => (
                                <AppointmentCard
                                    key={app.id}
                                    appointment={app}
                                    onManage={handleOpenModal}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
