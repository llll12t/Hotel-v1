"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, auth } from '@/app/lib/firebase';
import { doc, getDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { updateAppointmentStatusByAdmin, confirmAppointmentAndPaymentByAdmin, sendInvoiceToCustomer } from '@/app/actions/appointmentActions';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment, Service } from '@/types';

// --- Icons ---
const Icons = {
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    CreditCard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

// --- Modal: Edit Payment ---
interface EditPaymentModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (amount: string | number, method: string) => Promise<void>;
    defaultAmount?: number;
    defaultMethod?: string;
    currencySymbol?: string;
}

function EditPaymentModal({ open, onClose, onSave, defaultAmount, defaultMethod, currencySymbol }: EditPaymentModalProps) {
    const [amount, setAmount] = useState<string | number>(defaultAmount || '');
    const [method, setMethod] = useState(defaultMethod || 'เงินสด');
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">ยืนยันการชำระเงิน</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ยอดชำระ ({currencySymbol})</label>
                        <input type="number" className="w-full border rounded-md px-3 py-2 text-sm text-gray-900" value={amount} onChange={e => setAmount(e.target.value)} min="0" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ช่องทางชำระ</label>
                        <select className="w-full border rounded-md px-3 py-2 text-sm bg-white text-gray-900" value={method} onChange={e => setMethod(e.target.value)}>
                            <option value="เงินสด">เงินสด</option>
                            <option value="โอนเงิน">โอนเงิน</option>
                            <option value="บัตรเครดิต">บัตรเครดิต</option>
                            <option value="PromptPay">PromptPay</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">ยกเลิก</button>
                    <button onClick={async () => { setSaving(true); await onSave(amount, method); setSaving(false); }} disabled={saving} className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400">
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Modal: Completion Note ---
interface CompletionNoteModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (note: string) => Promise<void>;
    customerName: string;
    serviceInfo: any;
}

function CompletionNoteModal({ open, onClose, onSave, customerName, serviceInfo }: CompletionNoteModalProps) {
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const loadServiceNote = () => {
        const n = serviceInfo?.completionNote || '';
        if (n) setNote(n); else alert('ไม่มีข้อความที่กำหนดไว้');
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">ข้อความถึงลูกค้า</h2>
                <p className="text-sm text-gray-500 mb-4">ส่งข้อความขอบคุณให้ {customerName}</p>
                {serviceInfo?.completionNote && (
                    <button onClick={loadServiceNote} className="mb-3 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-xs font-medium hover:bg-blue-100">
                        ใช้ข้อความจากบริการ
                    </button>
                )}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ข้อความ (ไม่บังคับ)</label>
                    <textarea className="w-full border rounded-md px-3 py-2 h-24 resize-none text-sm" placeholder="เช่น ขอบคุณที่ใช้บริการ..." value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
                    <div className="text-xs text-gray-400 mt-1 text-right">{note.length}/200</div>
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">ยกเลิก</button>
                    <button onClick={async () => { setSaving(true); await onSave(note.trim()); setSaving(false); }} disabled={saving} className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400">
                        {saving ? 'กำลังส่ง...' : 'ส่งข้อความ'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Helpers ---
const InfoRow = ({ label, value }: { label: string, value: any }) => (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-900">{value || '-'}</span>
    </div>
);

const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { label: string, bg: string, text: string }> = {
        awaiting_confirmation: { label: 'รอยืนยัน', bg: 'bg-yellow-100', text: 'text-yellow-800' },
        confirmed: { label: 'ยืนยันแล้ว', bg: 'bg-blue-100', text: 'text-blue-800' },
        in_progress: { label: 'กำลังบริการ', bg: 'bg-purple-100', text: 'text-purple-800' },
        completed: { label: 'เสร็จสิ้น', bg: 'bg-green-100', text: 'text-green-800' },
        cancelled: { label: 'ยกเลิก', bg: 'bg-red-100', text: 'text-red-800' },
        pending: { label: 'จอง', bg: 'bg-gray-100', text: 'text-gray-800' },
    };
    const current = config[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-800' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${current.bg} ${current.text}`}>{current.label}</span>;
};

const STATUS_OPTIONS = [
    { value: 'awaiting_confirmation', label: 'รอยืนยัน' },
    { value: 'confirmed', label: 'ยืนยันแล้ว' },
    { value: 'in_progress', label: 'กำลังบริการ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' },
];

const formatPrice = (v: number | undefined) => v == null ? '-' : Number(v).toLocaleString();
const safeDate = (d: any) => { if (!d) return null; if (typeof d.toDate === 'function') return d.toDate(); return new Date(d); };

// --- Main Component ---
export default function AppointmentDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [serviceDetails, setServiceDetails] = useState<Service | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showEditPayment, setShowEditPayment] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCompletionNote, setShowCompletionNote] = useState(false);
    const [statusChangeInfo, setStatusChangeInfo] = useState<{ newStatus: string, statusLabel: string } | null>(null);
    const [isSendingInvoice, setIsSendingInvoice] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast("à¹„à¸¡à¹ˆà¸žà¸šà¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™", "error");
            return null;
        }
        return token;
    };

    const handleSavePayment = async (amount: string | number, method: string) => {
        if (!appointment?.id) return;
        try {
            const token = await getAdminToken();
            if (!token) return;
            const result = await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', { amount: Number(amount), method }, { adminToken: token });
            if (result.success) {
                showToast('อัพเดตการชำระเงินสำเร็จ', 'success');
                setShowEditPayment(false);
            } else showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        } catch (err: any) { showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error'); }
    };

    const handleStatusChange = (newStatus: string) => {
        if (!appointment || newStatus === appointment.status) return;
        if (newStatus === 'completed') { setShowCompletionNote(true); return; }
        setStatusChangeInfo({ newStatus, statusLabel: STATUS_OPTIONS.find(o => o.value === newStatus)?.label || newStatus });
    };

    const handleCompletionWithNote = async (note: string) => {
        if (!appointment?.id) return;
        setUpdating(true);
        try {
            const token = await getAdminToken();
            if (!token) return;
            const result = await updateAppointmentStatusByAdmin(appointment.id, 'completed', note, { adminToken: token });
            if (result.success) showToast('อัพเดทสถานะสำเร็จ', 'success');
            else showToast(`ไม่สำเร็จ: ${result.error}`, 'error');
        } catch (err: any) { showToast(`ไม่สำเร็จ: ${err.message}`, 'error'); }
        finally { setUpdating(false); setShowCompletionNote(false); }
    };

    const confirmStatusChange = async () => {
        if (!statusChangeInfo || !appointment?.id) return;
        setUpdating(true);
        try {
            const token = await getAdminToken();
            if (!token) return;
            const result = await updateAppointmentStatusByAdmin(appointment.id, statusChangeInfo.newStatus, undefined, { adminToken: token });
            if (result.success) showToast('อัพเดทสถานะสำเร็จ', 'success');
            else showToast(`ไม่สำเร็จ: ${result.error}`, 'error');
        } catch (err: any) { showToast(`ไม่สำเร็จ: ${err.message}`, 'error'); }
        finally { setUpdating(false); setStatusChangeInfo(null); }
    };

    const handleDelete = async () => {
        if (!appointment?.id) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, 'appointments', appointment.id));
            showToast('ลบการจองสำเร็จ', 'success');
            setDeleted(true);
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (err) { showToast('ลบไม่สำเร็จ', 'error'); }
        finally { setDeleting(false); setShowDeleteConfirm(false); }
    };

    const handleSendInvoice = async () => {
        if (!appointment?.id) return;
        setIsSendingInvoice(true);
        try {
            const token = await getAdminToken();
            if (!token) return;
            const result = await sendInvoiceToCustomer(appointment.id, { adminToken: token });
            if (result.success) showToast('ส่งลิงก์ชำระเงินแล้ว', 'success');
            else throw new Error(result.error);
        } catch (err: any) { showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error'); }
        finally { setIsSendingInvoice(false); }
    };

    useEffect(() => {
        if (!id || deleted) return;
        setLoading(true);
        const unsub = onSnapshot(doc(db, 'appointments', id), async (snap) => {
            if (!snap.exists()) { showToast('ไม่พบข้อมูล', 'error'); setAppointment(null); setLoading(false); return; }
            const raw = snap.data();
            // Safe cast
            const appData = { id: snap.id, ...raw, createdAt: safeDate(raw.createdAt), updatedAt: safeDate(raw.updatedAt) } as any;
            // We need to be permissive with types here because Firestore data can be messy

            setAppointment(appData);

            if (raw.serviceId) {
                try {
                    const sSnap = await getDoc(doc(db, 'services', raw.serviceId));
                    if (sSnap.exists()) setServiceDetails(sSnap.data() as Service);
                } catch { }
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, deleted, showToast]);

    if (deleted) return <div className="flex justify-center items-center min-h-[400px] text-gray-500">กำลังกลับสู่หน้าหลัก...</div>;
    if (loading || profileLoading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;
    if (!appointment) return <div className="flex justify-center items-center min-h-[400px] text-gray-500">ไม่พบข้อมูลการนัดหมาย</div>;

    const dateTime = safeDate(appointment.appointmentInfo?.dateTime || appointment.date);

    return (
        <div className="max-w-5xl mx-auto p-6">
            <ConfirmationModal show={showDeleteConfirm} title="ยืนยันการลบ" message="คุณแน่ใจหรือไม่ว่าต้องการลบการจองนี้?" onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} isProcessing={deleting} />
            <ConfirmationModal show={!!statusChangeInfo} title="ยืนยันการเปลี่ยนสถานะ" message={`เปลี่ยนสถานะเป็น "${statusChangeInfo?.statusLabel}"?`} onConfirm={confirmStatusChange} onCancel={() => setStatusChangeInfo(null)} isProcessing={updating} />
            <CompletionNoteModal open={showCompletionNote} onClose={() => setShowCompletionNote(false)} onSave={handleCompletionWithNote} customerName={appointment.customerInfo?.fullName || appointment.customerInfo?.name || 'ลูกค้า'} serviceInfo={serviceDetails || appointment.serviceInfo} />
            <EditPaymentModal open={showEditPayment} onClose={() => setShowEditPayment(false)} onSave={handleSavePayment} defaultAmount={appointment.paymentInfo?.totalPrice} defaultMethod={appointment.paymentInfo?.paymentMethod} currencySymbol={profile.currencySymbol} />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-md text-gray-500"><Icons.Back /></button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold text-gray-900">นัดหมาย #{appointment.id.substring(0, 6).toUpperCase()}</h1>
                            <StatusBadge status={appointment.status} />
                        </div>
                        <p className="text-sm text-gray-500">สร้างเมื่อ {appointment.createdAt ? format(appointment.createdAt as Date, 'd MMM yyyy, HH:mm', { locale: th }) : '-'}</p>
                    </div>
                </div>
                <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50">ลบการจอง</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Info */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                            <Icons.User />
                            <h2 className="text-sm font-semibold text-gray-900">ข้อมูลลูกค้า</h2>
                        </div>
                        <div className="p-5">
                            <InfoRow label="ชื่อลูกค้า" value={appointment.customerInfo?.fullName || appointment.customerInfo?.name} />
                            <InfoRow label="เบอร์โทร" value={appointment.customerInfo?.phone} />
                            <InfoRow label="LINE" value={appointment.userId ? <span className="text-green-600 text-xs">เชื่อมต่อแล้ว</span> : <span className="text-gray-400 text-xs">ไม่ได้เชื่อมต่อ</span>} />
                            <InfoRow label="หมายเหตุ" value={appointment.customerInfo?.note} />
                            {appointment.completionNote && (
                                <div className="mt-4 bg-green-50 border border-green-100 rounded-md p-3 text-sm text-green-800">
                                    <span className="font-medium text-xs uppercase text-green-600 block mb-1">ข้อความถึงลูกค้า:</span>
                                    {appointment.completionNote}
                                </div>
                            )}

                            {/* Status Actions */}
                            <div className="mt-6 pt-4 border-t">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-3">เปลี่ยนสถานะ</p>
                                <div className="flex flex-wrap gap-2">
                                    {appointment.status === 'awaiting_confirmation' && (
                                        <button onClick={() => handleStatusChange('confirmed')} disabled={updating} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">ยืนยันการจอง</button>
                                    )}
                                    {appointment.status === 'confirmed' && (
                                        <button onClick={() => handleStatusChange('in_progress')} disabled={updating} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700">เริ่มให้บริการ</button>
                                    )}
                                    {appointment.status === 'in_progress' && (
                                        <button onClick={() => handleStatusChange('completed')} disabled={updating} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">บริการเสร็จสิ้น</button>
                                    )}
                                    {STATUS_OPTIONS.filter(o => o.value !== appointment.status && !['confirmed', 'in_progress', 'completed'].includes(o.value)).map(o => (
                                        <button key={o.value} onClick={() => handleStatusChange(o.value)} disabled={updating} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">{o.label}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Service Info */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                            <Icons.Calendar />
                            <h2 className="text-sm font-semibold text-gray-900">รายละเอียดบริการ</h2>
                        </div>
                        <div className="p-5">
                            <div className="flex gap-4 mb-4">
                                <div className="w-24 h-24 relative rounded-md overflow-hidden bg-gray-100 flex-shrink-0 border">
                                    {appointment.serviceInfo?.imageUrl ? (
                                        <Image src={appointment.serviceInfo.imageUrl} alt="Service" fill className="object-cover" unoptimized />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-medium text-gray-900">{appointment.serviceInfo?.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                        <Icons.Clock />
                                        <span>{appointment.appointmentInfo?.duration || appointment.serviceInfo?.duration || 0} นาที</span>
                                    </div>
                                </div>
                            </div>
                            <InfoRow label="วันที่ & เวลา" value={dateTime ? format(dateTime, 'd MMM yyyy, HH:mm น.', { locale: th }) : '-'} />
                            <InfoRow label="พนักงาน" value={appointment.appointmentInfo?.technicianName || '-'} />
                            <InfoRow label="คิวที่" value={appointment.queue || appointment.queueNumber || '-'} />

                            {/* Add-ons */}
                            {(appointment.appointmentInfo?.addOns?.length || appointment.addOns?.length || 0) > 0 && (
                                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-md p-4">
                                    <h4 className="text-sm font-medium text-blue-800 mb-2">บริการเสริม</h4>
                                    {(appointment.appointmentInfo?.addOns || appointment.addOns || []).map((a, idx) => (
                                        <div key={idx} className="flex justify-between text-sm text-blue-900">
                                            <span>{a.name || a.title}</span>
                                            <span>{formatPrice(a.price)} {profile.currencySymbol}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Payment */}
                <div>
                    <div className="bg-white border border-gray-200 rounded-lg sticky top-20">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                            <Icons.CreditCard />
                            <h2 className="text-sm font-semibold text-gray-900">การชำระเงิน</h2>
                        </div>
                        <div className="p-5">
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">ราคาบริการ</span>
                                    <span className="text-gray-900">{formatPrice(appointment.paymentInfo?.originalPrice || appointment.serviceInfo?.price)} {profile.currencySymbol}</span>
                                </div>
                                {(appointment.paymentInfo?.addOnsTotal || 0) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">บริการเสริม</span>
                                        <span>+{formatPrice(appointment.paymentInfo?.addOnsTotal)} {profile.currencySymbol}</span>
                                    </div>
                                )}
                                {((appointment.paymentInfo?.discount || 0) > 0 || (appointment.paymentInfo?.couponDiscount || 0) > 0) && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>ส่วนลด</span>
                                        <span>-{formatPrice((appointment.paymentInfo?.discount || 0) + (appointment.paymentInfo?.couponDiscount || 0))} {profile.currencySymbol}</span>
                                    </div>
                                )}
                                <div className="border-t border-dashed my-2"></div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-900">ยอดรวมสุทธิ</span>
                                    <span className="font-bold text-lg text-gray-900">{formatPrice(appointment.paymentInfo?.totalPrice)} <span className="text-sm font-normal text-gray-500">{profile.currencySymbol}</span></span>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-md p-4 mb-4">
                                <InfoRow label="สถานะ" value={
                                    appointment.paymentInfo?.paymentStatus === 'paid' ? <span className="text-green-600 font-medium">ชำระแล้ว</span> :
                                        appointment.paymentInfo?.paymentStatus === 'invoiced' ? <span className="text-blue-600 font-medium">ส่งใบแจ้งหนี้แล้ว</span> :
                                            <span className="text-yellow-600 font-medium">รอชำระ</span>
                                } />
                                <InfoRow label="ช่องทาง" value={appointment.paymentInfo?.paymentMethod} />
                                {(appointment.paymentInfo as any)?.paidAt && (
                                    <InfoRow label="ชำระเมื่อ" value={format(safeDate((appointment.paymentInfo as any).paidAt), 'd MMM HH:mm', { locale: th })} />
                                )}
                            </div>

                            <div className="space-y-2">
                                <button onClick={handleSendInvoice} disabled={isSendingInvoice || appointment.paymentInfo?.paymentStatus === 'paid'} className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300">
                                    {isSendingInvoice ? 'กำลังส่ง...' : 'ส่งลิงก์ชำระเงิน'}
                                </button>
                                <button onClick={() => setShowEditPayment(true)} className="w-full py-2.5 text-sm font-medium text-gray-700 border rounded-md hover:bg-gray-50">
                                    บันทึกการชำระเงิน (Manual)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
