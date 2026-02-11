"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { saveProfileSettings, saveNotificationSettings, saveBookingSettings, savePointSettings, savePaymentSettings, saveCalendarSettings } from '@/app/actions/settingsActions';
import { sendDailyNotificationsNow } from '@/app/actions/dailyNotificationActions';
import { testAllIndexes, IndexStatus } from '@/app/actions/indexActions';
import { useToast } from '@/app/components/Toast';

// ============ UI COMPONENTS ============
const Card = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-5 space-y-4">{children}</div>
    </div>
);

const Toggle = ({ label, checked, onChange, disabled }: { label: string, checked?: boolean, onChange: (v: boolean) => void, disabled?: boolean }) => (
    <div className={`flex items-center justify-between py-1 ${disabled ? 'opacity-50' : ''}`}>
        <span className="text-sm text-gray-700">{label}</span>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" disabled={disabled} />
            <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-gray-900 peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
        </label>
    </div>
);

const Input = ({ label, ...props }: any) => (
    <div>
        <label className="block text-sm text-gray-600 mb-1">{label}</label>
        <input {...props} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
    </div>
);

const TextArea = ({ label, ...props }: any) => (
    <div>
        <label className="block text-sm text-gray-600 mb-1">{label}</label>
        <textarea {...props} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
    </div>
);

const Radio = ({ label, value, selected, onChange }: { label: string, value: string, selected: boolean, onChange: (v: string) => void }) => (
    <label className={`flex items-center p-3 rounded-md border cursor-pointer ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
        <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${selected ? 'border-blue-500' : 'border-gray-400'}`}>
            {selected && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
        </div>
        <span className="text-sm text-gray-700">{label}</span>
        <input type="radio" checked={selected} onChange={() => onChange(value)} className="sr-only" />
    </label>
);

// ============ MAIN PAGE ============
export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({
        allNotifications: { enabled: true },
        adminNotifications: { enabled: true, newBooking: true, bookingCancelled: true, paymentReceived: true, customerConfirmed: true },
        customerNotifications: { enabled: true, newBooking: true, appointmentConfirmed: true, serviceCompleted: true, appointmentCancelled: true, appointmentReminder: true, reviewRequest: true, paymentInvoice: true, dailyAppointmentNotification: true },
    });

    // Updated Booking Settings for HOTEL (Removed Technician/Queue stuff)
    const [bookingSettings, setBookingSettings] = useState<any>({
        checkInTime: '14:00',
        checkOutTime: '12:00',
        weeklySchedule: {},
        holidayDates: [],
        _newHolidayDate: '',
        _newHolidayReason: ''
    });

    const [pointSettings, setPointSettings] = useState<any>({ reviewPoints: 5, pointsPerCurrency: 100, pointsPerVisit: 1, enableReviewPoints: true, enablePurchasePoints: false, enableVisitPoints: false });
    const [paymentSettings, setPaymentSettings] = useState<any>({ method: 'promptpay', promptPayAccount: '', qrCodeImageUrl: '', bankInfoText: '' });
    const [calendarSettings, setCalendarSettings] = useState<any>({ enabled: false, calendarId: '' });
    const [profileSettings, setProfileSettings] = useState<any>({ storeName: '', contactPhone: '', address: '', description: '', currency: '฿', currencySymbol: 'บาท' });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [indexResults, setIndexResults] = useState<IndexStatus | null>(null);
    const [isCheckingIndexes, setIsCheckingIndexes] = useState(false);
    const { showToast } = useToast();

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast("ไม่พบการยืนยันตัวตน", "error");
            return null;
        }
        return token;
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const docs = ['notifications', 'booking', 'points', 'payment', 'calendar', 'profile'];
                const snaps = await Promise.all(docs.map(id => getDoc(doc(db, 'settings', id))));

                if (snaps[0].exists()) {
                    const data = snaps[0].data() as any;
                    setSettings((prev: any) => ({ ...prev, ...data, customerNotifications: { ...prev.customerNotifications, ...data.customerNotifications } }));
                }

                if (snaps[1].exists()) {
                    const data = snaps[1].data() as any;
                    // Standardize booking settings
                    setBookingSettings((prev: any) => ({
                        ...prev,
                        ...data,
                        checkInTime: data.checkInTime || '14:00',
                        checkOutTime: data.checkOutTime || '12:00',
                    }));
                }

                if (snaps[2].exists()) setPointSettings((prev: any) => ({ ...prev, ...snaps[2].data() as any }));
                if (snaps[3].exists()) setPaymentSettings((prev: any) => ({ ...prev, ...snaps[3].data() as any }));
                if (snaps[4].exists()) setCalendarSettings((prev: any) => ({ ...prev, ...snaps[4].data() as any }));
                if (snaps[5].exists()) setProfileSettings((prev: any) => ({ ...prev, ...snaps[5].data() as any }));
            } catch (e) { showToast('โหลดข้อมูลผิดพลาด', 'error'); }
            setLoading(false);
        };
        load();
    }, []);

    const handleNotifChange = (group: string, key: string, value: boolean) => {
        setSettings((prev: any) => {
            const newSettings = { ...prev, [group]: { ...prev[group], [key]: value } };
            if (group === 'allNotifications' && key === 'enabled' && !value) {
                newSettings.adminNotifications.enabled = false;
                newSettings.customerNotifications.enabled = false;
            }
            return newSettings;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setIsSaving(false);
                return;
            }
            const { updatedAt: _p, ...cleanProfile } = profileSettings;
            const { updatedAt: _n, ...cleanNotif } = settings;
            const { updatedAt: _b, ...cleanBooking } = bookingSettings;
            // Removed legacy fields normalizations

            const { updatedAt: _pt, ...cleanPoints } = pointSettings;
            const { updatedAt: _pm, ...cleanPayment } = paymentSettings;
            const { updatedAt: _c, ...cleanCalendar } = calendarSettings;

            const results = await Promise.all([
                saveProfileSettings(cleanProfile, { adminToken: token }),
                saveNotificationSettings(cleanNotif, { adminToken: token }),
                saveBookingSettings(cleanBooking, { adminToken: token }),
                savePointSettings(cleanPoints, { adminToken: token }),
                savePaymentSettings(cleanPayment, { adminToken: token }),
                saveCalendarSettings(cleanCalendar, { adminToken: token })
            ]);
            if (results.every(r => r.success)) showToast('บันทึกสำเร็จ', 'success');
            else throw new Error('บันทึกบางส่วนไม่สำเร็จ');
        } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
        setIsSaving(false);
    };

    const handleSendNow = async (isMock: boolean) => {
        setIsSending(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setIsSending(false);
                return;
            }
            const result = await sendDailyNotificationsNow(isMock, { adminToken: token });
            if (result.success) showToast(isMock ? 'ทดสอบสำเร็จ' : 'ส่งสำเร็จ', 'success');
            else throw new Error(result.error);
        } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
        setIsSending(false);
    };

    const handleCheckIndexes = async () => {
        setIsCheckingIndexes(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setIsCheckingIndexes(false);
                return;
            }
            const result = await testAllIndexes({ adminToken: token });
            setIndexResults(result);
            showToast(result.missingCount === 0 ? 'Indexes พร้อมใช้งาน' : `พบ ${result.missingCount} Indexes ที่ต้องสร้าง`, result.missingCount === 0 ? 'success' : 'warning');
        } catch (e) { showToast('เกิดข้อผิดพลาด', 'error'); }
        setIsCheckingIndexes(false);
    };

    const addHoliday = () => {
        if (!bookingSettings._newHolidayDate) return;
        setBookingSettings((prev: any) => ({ ...prev, holidayDates: [...(prev.holidayDates || []), { date: prev._newHolidayDate, reason: prev._newHolidayReason }].sort((a: any, b: any) => a.date.localeCompare(b.date)), _newHolidayDate: '', _newHolidayReason: '' }));
    };

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">ตั้งค่าระบบ</h1>
                    <p className="text-sm text-gray-500">จัดการการตั้งค่าทั้งหมดของโรงแรม</p>
                </div>
                <button onClick={handleSave} disabled={isSaving} className="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:bg-gray-400">
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

                {/* ข้อมูลโรงแรม */}
                <Card title="ข้อมูลโรงแรม">
                    <Input label="ชื่อโรงแรม" value={profileSettings.storeName} onChange={(e: any) => setProfileSettings({ ...profileSettings, storeName: e.target.value })} />
                    <Input label="เบอร์โทรติดต่อ" type="tel" value={profileSettings.contactPhone} onChange={(e: any) => setProfileSettings({ ...profileSettings, contactPhone: e.target.value })} />
                    <TextArea label="ที่อยู่" rows={2} value={profileSettings.address} onChange={(e: any) => setProfileSettings({ ...profileSettings, address: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="หน่วยเงิน (ย่อ)" value={profileSettings.currency} onChange={(e: any) => setProfileSettings({ ...profileSettings, currency: e.target.value })} placeholder="฿" />
                        <Input label="หน่วยเงิน (เต็ม)" value={profileSettings.currencySymbol} onChange={(e: any) => setProfileSettings({ ...profileSettings, currencySymbol: e.target.value })} placeholder="บาท" />
                    </div>
                </Card>

                {/* นโยบายการเข้าพัก */}
                <Card title="นโยบายการเข้าพัก">
                    <div className="grid grid-cols-2 gap-4">
                        <Input type="time" label="เวลาเช็คอิน (Check-in)" value={bookingSettings.checkInTime} onChange={(e: any) => setBookingSettings((p: any) => ({ ...p, checkInTime: e.target.value }))} />
                        <Input type="time" label="เวลาเช็คเอาท์ (Check-out)" value={bookingSettings.checkOutTime} onChange={(e: any) => setBookingSettings((p: any) => ({ ...p, checkOutTime: e.target.value }))} />
                    </div>
                </Card>

                {/* เวลาทำการ Front Desk (Optional) */}
                <Card title="เวลาทำการ">
                    {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((name, idx) => {
                        const day = bookingSettings.weeklySchedule?.[idx] || { isOpen: true, openTime: '00:00', closeTime: '23:59' };
                        return (
                            <div key={idx} className="flex items-center justify-between py-1">
                                <div className="flex items-center gap-2">
                                    <Toggle label="" checked={day.isOpen} onChange={v => setBookingSettings((p: any) => ({ ...p, weeklySchedule: { ...p.weeklySchedule, [idx]: { ...day, isOpen: v } } }))} />
                                    <span className={`text-sm w-6 ${day.isOpen ? 'text-gray-900' : 'text-gray-400'}`}>{name}</span>
                                </div>
                                {day.isOpen && (
                                    <div className="flex items-center gap-1">
                                        <input type="time" value={day.openTime} onChange={e => setBookingSettings((p: any) => ({ ...p, weeklySchedule: { ...p.weeklySchedule, [idx]: { ...day, openTime: e.target.value } } }))} className="px-1.5 py-1 border rounded text-xs w-20 text-gray-900" />
                                        <span className="text-gray-400 text-xs">-</span>
                                        <input type="time" value={day.closeTime} onChange={e => setBookingSettings((p: any) => ({ ...p, weeklySchedule: { ...p.weeklySchedule, [idx]: { ...day, closeTime: e.target.value } } }))} className="px-1.5 py-1 border rounded text-xs w-20 text-gray-900" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </Card>

                {/* วันหยุด */}
                <Card title="วันหยุดพิเศษ">
                    <div className="flex gap-2">
                        <input type="date" value={bookingSettings._newHolidayDate} onChange={e => setBookingSettings((p: any) => ({ ...p, _newHolidayDate: e.target.value }))} className="flex-1 px-2 py-1.5 border rounded text-sm text-gray-900" min={new Date().toISOString().split('T')[0]} />
                        <input type="text" value={bookingSettings._newHolidayReason || ''} onChange={e => setBookingSettings((p: any) => ({ ...p, _newHolidayReason: e.target.value }))} placeholder="สาเหตุ" className="flex-1 px-2 py-1.5 border rounded text-sm text-gray-900" />
                        <button onClick={addHoliday} disabled={!bookingSettings._newHolidayDate} className="px-3 py-1.5 bg-red-500 text-white rounded text-sm disabled:bg-gray-300">+</button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {(bookingSettings.holidayDates || []).map((h: any) => (
                            <span key={h.date} className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">
                                {h.date} {h.reason && `(${h.reason})`}
                                <button onClick={() => setBookingSettings((p: any) => ({ ...p, holidayDates: p.holidayDates.filter((x: any) => x.date !== h.date) }))} className="text-red-400 hover:text-red-600">×</button>
                            </span>
                        ))}
                    </div>
                </Card>

                {/* การชำระเงิน */}
                <Card title="การชำระเงิน">
                    <div className="space-y-2">
                        <Radio label="PromptPay" value="promptpay" selected={paymentSettings.method === 'promptpay'} onChange={v => setPaymentSettings({ ...paymentSettings, method: v })} />
                        <Radio label="รูปภาพ QR Code" value="image" selected={paymentSettings.method === 'image'} onChange={v => setPaymentSettings({ ...paymentSettings, method: v })} />
                        <Radio label="ข้อมูลบัญชีธนาคาร" value="bankinfo" selected={paymentSettings.method === 'bankinfo'} onChange={v => setPaymentSettings({ ...paymentSettings, method: v })} />
                    </div>
                    {paymentSettings.method === 'promptpay' && <Input label="เบอร์ PromptPay" value={paymentSettings.promptPayAccount} onChange={(e: any) => setPaymentSettings({ ...paymentSettings, promptPayAccount: e.target.value })} placeholder="0812345678" />}
                    {paymentSettings.method === 'image' && (
                        <>
                            <Input label="URL รูปภาพ QR" value={paymentSettings.qrCodeImageUrl} onChange={(e: any) => setPaymentSettings({ ...paymentSettings, qrCodeImageUrl: e.target.value })} />
                            {paymentSettings.qrCodeImageUrl && <img src={paymentSettings.qrCodeImageUrl} alt="QR" className="w-24 h-24 border rounded object-cover" />}
                        </>
                    )}
                    {paymentSettings.method === 'bankinfo' && <TextArea label="ข้อมูลบัญชี" rows={3} value={paymentSettings.bankInfoText} onChange={(e: any) => setPaymentSettings({ ...paymentSettings, bankInfoText: e.target.value })} />}
                </Card>

                {/* ระบบพ้อยต์ */}
                <Card title="ระบบสะสมพ้อยต์">
                    <div className="space-y-3">
                        <div className="bg-gray-50 p-3 rounded border">
                            <Toggle label="ให้พ้อยต์หลังรีวิว" checked={pointSettings.enableReviewPoints} onChange={v => setPointSettings((p: any) => ({ ...p, enableReviewPoints: v }))} />
                            {pointSettings.enableReviewPoints && <div className="mt-2 pt-2 border-t"><Input label="พ้อยต์ที่ได้" type="number" value={pointSettings.reviewPoints} onChange={(e: any) => setPointSettings((p: any) => ({ ...p, reviewPoints: parseInt(e.target.value) || 5 }))} /></div>}
                        </div>
                        <div className="bg-gray-50 p-3 rounded border">
                            <Toggle label="ให้พ้อยต์ตามยอดซื้อ" checked={pointSettings.enablePurchasePoints} onChange={v => setPointSettings((p: any) => ({ ...p, enablePurchasePoints: v }))} />
                            {pointSettings.enablePurchasePoints && <div className="mt-2 pt-2 border-t"><Input label={`ยอดซื้อกี่ ${profileSettings.currencySymbol} ต่อ 1 พ้อยต์`} type="number" value={pointSettings.pointsPerCurrency} onChange={(e: any) => setPointSettings((p: any) => ({ ...p, pointsPerCurrency: parseInt(e.target.value) || 100 }))} /></div>}
                        </div>
                        <div className="bg-gray-50 p-3 rounded border">
                            <Toggle label="ให้พ้อยต์ต่อครั้งที่มา" checked={pointSettings.enableVisitPoints} onChange={v => setPointSettings((p: any) => ({ ...p, enableVisitPoints: v }))} />
                            {pointSettings.enableVisitPoints && <div className="mt-2 pt-2 border-t"><Input label="พ้อยต์ที่ได้" type="number" value={pointSettings.pointsPerVisit} onChange={(e: any) => setPointSettings((p: any) => ({ ...p, pointsPerVisit: parseInt(e.target.value) || 1 }))} /></div>}
                        </div>
                    </div>
                </Card>

                {/* แจ้งเตือน Admin */}
                <Card title="แจ้งเตือน LINE - Admin">
                    <div className="bg-blue-50 p-3 rounded border border-blue-100 mb-3">
                        <Toggle label="เปิดการแจ้งเตือนทั้งหมด" checked={settings.allNotifications.enabled} onChange={v => handleNotifChange('allNotifications', 'enabled', v)} />
                    </div>
                    <Toggle label="เปิดแจ้งเตือน Admin" checked={settings.adminNotifications.enabled} onChange={v => handleNotifChange('adminNotifications', 'enabled', v)} disabled={!settings.allNotifications.enabled} />
                    {settings.adminNotifications.enabled && (
                        <div className="pl-3 border-l-2 border-gray-100 space-y-1">
                            <Toggle label="เมื่อมีการจองใหม่" checked={settings.adminNotifications.newBooking} onChange={v => handleNotifChange('adminNotifications', 'newBooking', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="เมื่อลูกค้ายืนยัน" checked={settings.adminNotifications.customerConfirmed} onChange={v => handleNotifChange('adminNotifications', 'customerConfirmed', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="เมื่อมีการยกเลิก" checked={settings.adminNotifications.bookingCancelled} onChange={v => handleNotifChange('adminNotifications', 'bookingCancelled', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="เมื่อมีการชำระเงิน" checked={settings.adminNotifications.paymentReceived} onChange={v => handleNotifChange('adminNotifications', 'paymentReceived', v)} disabled={!settings.allNotifications.enabled} />
                        </div>
                    )}
                </Card>

                {/* แจ้งเตือนลูกค้า */}
                <Card title="แจ้งเตือน LINE - ลูกค้า">
                    <Toggle label="เปิดแจ้งเตือนลูกค้า" checked={settings.customerNotifications.enabled} onChange={v => handleNotifChange('customerNotifications', 'enabled', v)} disabled={!settings.allNotifications.enabled} />
                    {settings.customerNotifications.enabled && (
                        <div className="pl-3 border-l-2 border-gray-100 space-y-1">
                            <Toggle label="เมื่อมีการจองใหม่" checked={settings.customerNotifications.newBooking} onChange={v => handleNotifChange('customerNotifications', 'newBooking', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="เมื่อยืนยันนัดหมาย" checked={settings.customerNotifications.appointmentConfirmed} onChange={v => handleNotifChange('customerNotifications', 'appointmentConfirmed', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="เมื่อบริการเสร็จสิ้น" checked={settings.customerNotifications.serviceCompleted} onChange={v => handleNotifChange('customerNotifications', 'serviceCompleted', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="เมื่อยกเลิกนัดหมาย" checked={settings.customerNotifications.appointmentCancelled} onChange={v => handleNotifChange('customerNotifications', 'appointmentCancelled', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="แจ้งเตือนล่วงหน้า 1 ชม." checked={settings.customerNotifications.appointmentReminder} onChange={v => handleNotifChange('customerNotifications', 'appointmentReminder', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="แจ้งเตือนประจำวัน" checked={settings.customerNotifications.dailyAppointmentNotification} onChange={v => handleNotifChange('customerNotifications', 'dailyAppointmentNotification', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="แจ้งเตือนชำระเงิน" checked={settings.customerNotifications.paymentInvoice} onChange={v => handleNotifChange('customerNotifications', 'paymentInvoice', v)} disabled={!settings.allNotifications.enabled} />
                            <Toggle label="แจ้งเตือนขอรีวิว" checked={settings.customerNotifications.reviewRequest} onChange={v => handleNotifChange('customerNotifications', 'reviewRequest', v)} disabled={!settings.allNotifications.enabled} />
                        </div>
                    )}
                </Card>

                {/* Google Calendar */}
                <Card title="Google Calendar">
                    <Toggle label="เปิดการเชื่อมต่อ" checked={calendarSettings.enabled} onChange={v => setCalendarSettings((p: any) => ({ ...p, enabled: v }))} />
                    {calendarSettings.enabled && (
                        <>
                            <Input label="Calendar ID" value={calendarSettings.calendarId} onChange={(e: any) => setCalendarSettings((p: any) => ({ ...p, calendarId: e.target.value }))} placeholder="your-email@group.calendar.google.com" />
                            <p className="text-xs text-gray-500">ต้องแชร์ปฏิทินให้ Service Account Email</p>
                        </>
                    )}
                </Card>

                {/* ทดสอบแจ้งเตือน */}
                <Card title="ทดสอบแจ้งเตือน">
                    <p className="text-sm text-gray-500 mb-3">ส่งแจ้งเตือนประจำวัน (Manual)</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleSendNow(true)} disabled={isSending} className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50">
                            {isSending ? '...' : '🎭 ทดสอบ'}
                        </button>
                        <button onClick={() => handleSendNow(false)} disabled={isSending} className="px-3 py-2 bg-gray-900 text-white rounded text-sm hover:bg-gray-800 disabled:opacity-50">
                            {isSending ? '...' : '🚀 ส่งจริง'}
                        </button>
                    </div>
                </Card>


                {/* Firestore Indexes */}
                <Card title="Firestore Indexes">
                    <p className="text-sm text-gray-500 mb-3">ตรวจสอบ Indexes ที่จำเป็น</p>
                    <button onClick={handleCheckIndexes} disabled={isCheckingIndexes} className="w-full px-4 py-2 bg-gray-900 text-white rounded text-sm hover:bg-gray-800 disabled:bg-gray-400">
                        {isCheckingIndexes ? 'กำลังตรวจสอบ...' : '🔍 ตรวจสอบ Indexes'}
                    </button>
                    {indexResults && (
                        <div className="mt-3 space-y-2">
                            <div className="flex gap-2">
                                <div className="flex-1 bg-green-50 p-2 rounded text-center border border-green-100"><div className="text-lg font-bold text-green-600">{indexResults.okCount}</div><div className="text-xs text-green-500">พร้อม</div></div>
                                <div className="flex-1 bg-red-50 p-2 rounded text-center border border-red-100"><div className="text-lg font-bold text-red-600">{indexResults.missingCount}</div><div className="text-xs text-red-500">ต้องสร้าง</div></div>
                            </div>
                            {indexResults.indexUrls && indexResults.indexUrls.length > 0 && indexResults.indexUrls.map((item, idx) => (
                                <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-2 bg-amber-50 rounded border border-amber-200 hover:border-amber-400 text-sm">
                                    <div className="font-medium text-gray-800">{item.name}</div>
                                    <div className="text-xs text-gray-500">{item.description}</div>
                                </a>
                            ))}
                            {indexResults.missingCount === 0 && <div className="bg-green-50 p-2 rounded text-green-700 text-sm">✅ Indexes พร้อมใช้งาน</div>}
                        </div>
                    )}
                </Card>

            </div>
        </div>
    );
}
