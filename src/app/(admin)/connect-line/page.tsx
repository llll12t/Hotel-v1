"use client";

import { useState } from 'react';
import { connectLineToCustomer } from '@/app/actions/customerActions';
import { getPointsByPhone } from '@/app/actions/pointActions';
import { useToast } from '@/app/components/Toast';
import { auth } from '@/app/lib/firebase';

export default function ConnectLinePage() {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        phoneNumber: '',
        userId: '',
        fullName: '',
        email: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
    const [pointsPreview, setPointsPreview] = useState<any>(null);
    const [checkingPoints, setCheckingPoints] = useState(false);

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast('à¹„à¸¡à¹ˆà¸žà¸šà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™', 'error');
            return null;
        }
        return token;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (message) setMessage('');
    };

    const handleCheckPoints = async () => {
        if (!formData.phoneNumber.trim()) {
            setMessage('กรุณากรอกเบอร์โทรศัพท์');
            setMessageType('error');
            return;
        }

        setCheckingPoints(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setCheckingPoints(false);
                return;
            }
            const result = await getPointsByPhone(formData.phoneNumber.trim(), { adminToken: token });
            if (result.success) {
                setPointsPreview(result);
                if (result.points > 0) {
                    setMessage(`พบคะแนนสะสม ${result.points} คะแนนสำหรับเบอร์นี้`);
                    setMessageType('success');
                } else {
                    setMessage('ไม่พบคะแนนสะสมสำหรับเบอร์นี้');
                    setMessageType('info');
                }
            } else {
                setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
                setMessageType('error');
                setPointsPreview(null);
            }
        } catch (error: any) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
            setMessageType('error');
            setPointsPreview(null);
        } finally {
            setCheckingPoints(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.phoneNumber.trim() || !formData.userId.trim()) {
            setMessage('กรุณากรอกเบอร์โทรศัพท์และ LINE User ID');
            setMessageType('error');
            return;
        }

        setLoading(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setLoading(false);
                return;
            }
            const result: any = await connectLineToCustomer(
                formData.phoneNumber.trim(),
                formData.userId.trim(),
                {
                    fullName: formData.fullName.trim(),
                    email: formData.email.trim()
                },
                { adminToken: token }
            );

            if (result.success) {
                setMessage(result.message || 'เชื่อมต่อสำเร็จ');
                setMessageType('success');
                showToast('เชื่อมต่อสำเร็จ', 'success');
                setFormData({
                    phoneNumber: '',
                    userId: '',
                    fullName: '',
                    email: ''
                });
                setPointsPreview(null);
            } else {
                setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
                setMessageType('error');
            }
        } catch (error: any) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">เชื่อมต่อ LINE ID กับลูกค้า</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Phone Number */}
                    <div>
                        <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                            เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                id="phoneNumber"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleInputChange}
                                placeholder="กรอกเบอร์โทรศัพท์"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                required
                            />
                            <button
                                type="button"
                                onClick={handleCheckPoints}
                                disabled={checkingPoints || !formData.phoneNumber.trim()}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {checkingPoints ? 'กำลังตรวจสอบ...' : 'ตรวจสอบคะแนน'}
                            </button>
                        </div>
                    </div>

                    {/* Points Preview */}
                    {pointsPreview && (
                        <div className={`p-4 rounded-md ${pointsPreview.points > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                            <h3 className="font-medium text-gray-900 mb-2 text-sm">ข้อมูลคะแนนปัจจุบัน</h3>
                            <div className="text-sm text-gray-700">
                                <p>คะแนนที่จะรวม: <span className="font-bold text-green-600">{pointsPreview.points} คะแนน</span></p>
                                {pointsPreview.customerInfo && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        วันที่ได้รับคะแนนล่าสุด: {pointsPreview.customerInfo.lastPointsDate ? new Date(pointsPreview.customerInfo.lastPointsDate.seconds * 1000).toLocaleDateString('th-TH') : 'ไม่ระบุ'}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* LINE User ID */}
                    <div>
                        <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                            LINE User ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="userId"
                            name="userId"
                            value={formData.userId}
                            onChange={handleInputChange}
                            placeholder="กรอก LINE User ID"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">LINE User ID ที่ได้จากการเชื่อมต่อ LINE Bot</p>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">ชื่อ-นามสกุล</label>
                        <input
                            type="text"
                            id="fullName"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleInputChange}
                            placeholder="กรอกชื่อ-นามสกุล (ถ้ามี)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">อีเมล</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="กรอกอีเมล (ถ้ามี)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                        {loading ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ LINE ID'}
                    </button>
                </form>

                {/* Message */}
                {message && (
                    <div className={`mt-6 p-4 rounded-md text-sm ${messageType === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                            messageType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Instructions */}
                <div className="mt-8 bg-yellow-50 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-yellow-900 mb-3">วิธีการใช้งาน</h3>
                    <ol className="space-y-2 text-xs text-yellow-700 list-decimal list-inside">
                        <li>กรอกเบอร์โทรศัพท์ของลูกค้าแล้วกดตรวจสอบคะแนน</li>
                        <li>กรอก LINE User ID ที่ได้จากการเชื่อมต่อ LINE Bot</li>
                        <li>กรอกข้อมูลเพิ่มเติม (ถ้ามี)</li>
                        <li>กดปุ่มเชื่อมต่อ LINE ID</li>
                        <li>ระบบจะรวมคะแนนจากระบบเบอร์โทรอัตโนมัติ (ถ้ามี)</li>
                    </ol>
                    <div className="mt-4 p-3 bg-yellow-100 rounded border border-yellow-300">
                        <p className="text-xs text-yellow-800">
                            <strong>หมายเหตุ:</strong> หลังจากเชื่อมต่อแล้ว ลูกค้าจะสามารถรับแจ้งเตือนผ่าน LINE และสะสมคะแนนได้ปกติ
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
