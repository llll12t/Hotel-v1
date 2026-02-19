"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, auth } from '@/app/lib/firebase';
import { doc, getDoc, getDocs, collection, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updateAppointmentStatusByAdmin, confirmAppointmentAndPaymentByAdmin, sendInvoiceToCustomer } from '@/app/actions/appointmentActions';
import { getPaymentSlipsByAppointmentForAdmin } from '@/app/actions/paymentSlipActions';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────
const safeDate = (d: any) => {
    if (!d) return null;
    if (typeof d.toDate === 'function') return d.toDate();
    return new Date(d);
};
const formatPrice = (v: number | undefined) => (v == null ? '-' : Number(v).toLocaleString());
const formatDisplayDate = (d: string | undefined | null) => {
    if (!d) return '-';
    try {
        const [y, m, day] = d.split('-');
        if (y && m && day) return `${day}/${m}/${y}`;
        return d;
    } catch { return d; }
};

// ── Status Config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    awaiting_confirmation: { label: 'รอชำระ', dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
    pending: { label: 'รอชำระ', dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
    confirmed: { label: 'ชำระแล้ว', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
    in_progress: { label: 'เช็คอินแล้ว', dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
    completed: { label: 'เช็คเอาท์', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    cancelled: { label: 'ยกเลิก', dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-600' },
    blocked: { label: 'ไม่ว่าง', dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' },
};

const STATUS_OPTIONS = [
    { value: 'awaiting_confirmation', label: 'รอชำระ' },
    { value: 'pending', label: 'รอชำระ' },
    { value: 'confirmed', label: 'ชำระแล้ว' },
    { value: 'in_progress', label: 'เช็คอินแล้ว' },
    { value: 'completed', label: 'เช็คเอาท์แล้ว' },
    { value: 'cancelled', label: 'ยกเลิก' },
];

// ── Info Row ────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
        <span className="text-sm text-gray-400 font-medium">{label}</span>
        <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%]">{value || '-'}</span>
    </div>
);

// ── Status Badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
};

// ── Section Card ────────────────────────────────────────────────────────────
const SectionCard = ({ title, icon, action, children }: {
    title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) => (
    <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                {icon && <span className="text-gray-400">{icon}</span>}
                <h2 className="text-sm font-bold text-gray-900">{title}</h2>
            </div>
            {action}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

// ── Modal Wrapper ────────────────────────────────────────────────────────────
const ModalWrap = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-md shadow-2xl w-full max-w-md">{children}</div>
    </div>
);

const modalInput = "w-full border border-gray-200 bg-gray-50 rounded-md px-3.5 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-gray-900 outline-none transition-all";
const modalLabel = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5";

// ── Edit Payment Modal ──────────────────────────────────────────────────────
function EditPaymentModal({ open, onClose, onSave, defaultAmount, defaultMethod, currencySymbol }: {
    open: boolean; onClose: () => void; onSave: (a: string | number, m: string) => Promise<void>;
    defaultAmount?: number; defaultMethod?: string; currencySymbol?: string;
}) {
    const [amount, setAmount] = useState<string | number>(defaultAmount || '');
    const [method, setMethod] = useState(defaultMethod || 'เงินสด');
    const [saving, setSaving] = useState(false);
    if (!open) return null;
    return (
        <ModalWrap>
            <div className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">ยืนยันการชำระเงิน</h2>
                <div className="space-y-4">
                    <div>
                        <label className={modalLabel}>ยอดชำระ ({currencySymbol})</label>
                        <input type="number" className={modalInput} value={amount} onChange={e => setAmount(e.target.value)} min="0" />
                    </div>
                    <div>
                        <label className={modalLabel}>ช่องทางชำระ</label>
                        <select className={modalInput} value={method} onChange={e => setMethod(e.target.value)}>
                            <option value="เงินสด">เงินสด</option>
                            <option value="โอนเงิน">โอนเงิน</option>
                            <option value="บัตรเครดิต">บัตรเครดิต</option>
                            <option value="PromptPay">PromptPay</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">ยกเลิก</button>
                    <button onClick={async () => { setSaving(true); await onSave(amount, method); setSaving(false); }} disabled={saving} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#1A1A1A] rounded-md hover:opacity-90 disabled:opacity-50 transition-all shadow-sm">
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </ModalWrap>
    );
}

// ── Checkout Modal ──────────────────────────────────────────────────────────
function CheckoutModal({ open, onClose, onConfirm, currencySymbol }: {
    open: boolean; onClose: () => void; onConfirm: (r: string, f: number, n: string) => Promise<void>; currencySymbol?: string;
}) {
    const [reason, setReason] = useState('ปกติ');
    const [fine, setFine] = useState('');
    const [note, setNote] = useState('');
    const [processing, setProcessing] = useState(false);
    if (!open) return null;
    return (
        <ModalWrap>
            <div className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">รายละเอียดการเช็คเอาท์</h2>
                <div className="space-y-4">
                    <div>
                        <label className={modalLabel}>สาเหตุการออก</label>
                        <select className={modalInput} value={reason} onChange={e => setReason(e.target.value)}>
                            <option value="ปกติ">ครบกำหนด (ปกติ)</option>
                            <option value="ออกก่อนกำหนด">ลูกค้าแจ้งออกก่อนกำหนด</option>
                            <option value="ผิดระเบียบ">ให้ออก (ผิดระเบียบ)</option>
                            <option value="เหตุสุดวิสัย">เหตุสุดวิสัย</option>
                            <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                    </div>
                    <div>
                        <label className={modalLabel}>ค่าปรับ / ค่าเสียหาย ({currencySymbol})</label>
                        <input type="number" placeholder="0.00" className={modalInput} value={fine} onChange={e => setFine(e.target.value)} min="0" />
                    </div>
                    <div>
                        <label className={modalLabel}>หมายเหตุ</label>
                        <textarea rows={3} className={`${modalInput} resize-none`} placeholder="รายละเอียดเพิ่มเติม..." value={note} onChange={e => setNote(e.target.value)} />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">ยกเลิก</button>
                    <button onClick={async () => { setProcessing(true); await onConfirm(reason, Number(fine) || 0, note); setProcessing(false); onClose(); }} disabled={processing}
                        className="flex-1 py-2.5 text-sm font-bold text-white bg-[#1A1A1A] rounded-md hover:opacity-90 disabled:opacity-50 transition-all shadow-sm">
                        {processing ? 'กำลังบันทึก...' : 'ยืนยันเช็คเอาท์'}
                    </button>
                </div>
            </div>
        </ModalWrap>
    );
}

// ── Edit Booking Modal ──────────────────────────────────────────────────────
function EditBookingModal({ open, onClose, onSave, defaultData, rooms }: {
    open: boolean; onClose: () => void; onSave: (d: any) => Promise<void>; defaultData: any; rooms: any[];
}) {
    const [formData, setFormData] = useState(defaultData || {});
    const [processing, setProcessing] = useState(false);
    useEffect(() => { if (defaultData) setFormData({ ...defaultData, roomId: defaultData.roomId || '' }); }, [defaultData]);
    const handleChange = (e: any) => { const { name, value } = e.target; setFormData((prev: any) => ({ ...prev, [name]: value })); };
    if (!open) return null;
    return (
        <ModalWrap>
            <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">แก้ไขข้อมูลการจอง</h3>
                <div className="space-y-4">
                    <div>
                        <label className={modalLabel}>ห้องพัก</label>
                        <select name="roomId" value={formData.roomId} onChange={handleChange} className={modalInput}>
                            <option value="">-- ไม่ระบุห้อง --</option>
                            {rooms.map(r => <option key={r.id} value={r.id}>{r.number} {r.type ? `(${r.type})` : ''}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={modalLabel}>เช็คอิน</label>
                            <input type="date" name="checkInDate" value={formData.checkInDate || ''} onChange={handleChange} className={modalInput} />
                        </div>
                        <div>
                            <label className={modalLabel}>เช็คเอาท์</label>
                            <input type="date" name="checkOutDate" value={formData.checkOutDate || ''} onChange={handleChange} className={modalInput} />
                        </div>
                    </div>
                    <div>
                        <label className={modalLabel}>จำนวนผู้เข้าพัก</label>
                        <input type="number" name="guests" value={formData.guests || 1} onChange={handleChange} className={modalInput} />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">ยกเลิก</button>
                    <button onClick={async () => { setProcessing(true); await onSave(formData); setProcessing(false); onClose(); }} disabled={processing}
                        className="flex-1 py-2.5 text-sm font-bold text-white bg-[#1A1A1A] rounded-md hover:opacity-90 disabled:opacity-50 transition-all shadow-sm">
                        {processing ? 'บันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </ModalWrap>
    );
}

// ── Payment Slip Item ───────────────────────────────────────────────────────
interface PaymentSlipItem {
    id: string; slipBase64: string; mimeType?: string; sizeBytes?: number;
    note?: string; status?: string; createdAt?: string | null; expiresAt?: string | null;
}

// ── Icons ───────────────────────────────────────────────────────────────────
const UserIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const CalIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const CardIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const EditIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const BackIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>;
const PencilIcon = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AppointmentDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showEditPayment, setShowEditPayment] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [statusChangeInfo, setStatusChangeInfo] = useState<{ newStatus: string; statusLabel: string } | null>(null);
    const [isSendingInvoice, setIsSendingInvoice] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const [roomNumber, setRoomNumber] = useState('-');
    const [rooms, setRooms] = useState<any[]>([]);
    const [showEditBooking, setShowEditBooking] = useState(false);
    const [paymentSlips, setPaymentSlips] = useState<PaymentSlipItem[]>([]);
    const [loadingSlips, setLoadingSlips] = useState(false);
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { showToast('ไม่พบการยืนยันตัวตน', 'error'); return null; }
        return token;
    };

    useEffect(() => {
        if (!id || deleted) return;
        setLoading(true);
        const unsub = onSnapshot(doc(db, 'appointments', id), async snap => {
            if (!snap.exists()) { showToast('ไม่พบข้อมูล', 'error'); setAppointment(null); setLoading(false); return; }
            const raw = snap.data();
            const appData = { id: snap.id, ...raw, createdAt: safeDate(raw.createdAt), updatedAt: safeDate(raw.updatedAt) } as any;
            let roomNo = '-';
            if (appData.bookingInfo?.roomId) {
                try {
                    const roomSnap = await getDoc(doc(db, 'rooms', appData.bookingInfo.roomId));
                    if (roomSnap.exists()) roomNo = roomSnap.data().number;
                } catch (e) { console.error(e); }
            } else if (appData.bookingInfo?.roomNumber) {
                roomNo = appData.bookingInfo.roomNumber;
            }
            setRoomNumber(roomNo);
            setAppointment(appData);
            setLoading(false);
        });
        return () => unsub();
    }, [id, deleted, showToast]);

    useEffect(() => {
        getDocs(collection(db, 'rooms')).then(snap =>
            setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (a.number || '').localeCompare(b.number || '')))
        ).catch(console.error);
    }, []);

    useEffect(() => {
        const fetch = async () => {
            if (!id || deleted) return;
            setLoadingSlips(true);
            try {
                const token = await getAdminToken();
                if (!token) return;
                const result = await getPaymentSlipsByAppointmentForAdmin(id, { adminToken: token });
                if (result.success) setPaymentSlips(result.slips as PaymentSlipItem[]);
                else showToast(`โหลดสลิปไม่สำเร็จ: ${result.error}`, 'warning');
            } catch (err: any) { showToast(`โหลดสลิปไม่สำเร็จ: ${err.message}`, 'error'); }
            finally { setLoadingSlips(false); }
        };
        fetch();
    }, [id, deleted, showToast, appointment?.paymentInfo?.latestSlipId]);

    const handleUpdateBooking = async (data: any) => {
        if (!appointment?.id) return;
        try {
            await getAdminToken();
            let newRoomNumber = roomNumber;
            if (data.roomId && rooms.length > 0) {
                const r = rooms.find(rm => rm.id === data.roomId);
                if (r) newRoomNumber = r.number;
            }
            await updateDoc(doc(db, 'appointments', appointment.id), {
                'bookingInfo.checkInDate': data.checkInDate,
                'bookingInfo.checkOutDate': data.checkOutDate,
                'bookingInfo.guests': data.guests,
                'bookingInfo.roomId': data.roomId || null,
                'bookingInfo.roomNumber': newRoomNumber,
                updatedAt: new Date()
            });
            showToast('บันทึกข้อมูลเรียบร้อย', 'success');
        } catch (error: any) { showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error'); }
    };

    const handleSavePayment = async (amount: string | number, method: string) => {
        if (!appointment?.id) return;
        try {
            const token = await getAdminToken(); if (!token) return;
            const result = await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', { amount: Number(amount), method }, { adminToken: token });
            if (result.success) { showToast('อัพเดตการชำระเงินสำเร็จ', 'success'); setShowEditPayment(false); }
            else showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        } catch (err: any) { showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error'); }
    };

    const handleConfirmPayment = async () => {
        if (!appointment?.id) return;
        setUpdating(true);
        try {
            const token = await getAdminToken(); if (!token) return;
            const result = await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', {
                amount: Number(appointment.paymentInfo?.totalPrice || 0),
                method: appointment.paymentInfo?.paymentMethod || 'โอนเงิน',
            }, { adminToken: token });
            if (result.success) showToast('ยืนยันการชำระเงินสำเร็จ', 'success');
            else showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        } catch (err: any) { showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error'); }
        finally { setUpdating(false); }
    };

    const handleStatusChange = (newStatus: string) => {
        if (!appointment || newStatus === appointment.status) return;
        setStatusChangeInfo({ newStatus, statusLabel: STATUS_OPTIONS.find(o => o.value === newStatus)?.label || newStatus });
    };

    const confirmStatusChange = async () => {
        if (!statusChangeInfo || !appointment?.id) return;
        setUpdating(true);
        try {
            const token = await getAdminToken(); if (!token) return;
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
        } catch { showToast('ลบไม่สำเร็จ', 'error'); }
        finally { setDeleting(false); setShowDeleteConfirm(false); }
    };

    const handleSendInvoice = async () => {
        if (!appointment?.id) return;
        setIsSendingInvoice(true);
        try {
            const token = await getAdminToken(); if (!token) return;
            const result = await sendInvoiceToCustomer(appointment.id, { adminToken: token });
            if (result.success) showToast('ส่งลิงก์ชำระเงินแล้ว', 'success');
            else throw new Error(result.error);
        } catch (err: any) { showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error'); }
        finally { setIsSendingInvoice(false); }
    };

    // ── States ──────────────────────────────────────────────────────────────
    if (deleted) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-gray-400 text-sm">กำลังกลับสู่หน้าหลัก...</p>
        </div>
    );
    if (loading || profileLoading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">กำลังโหลด...</p>
            </div>
        </div>
    );
    if (!appointment) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-gray-400 text-sm">ไม่พบข้อมูลการจอง</p>
        </div>
    );

    const dueAt = safeDate(appointment.paymentInfo?.paymentDueAt);
    const payStatus = appointment.paymentInfo?.paymentStatus;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {/* Modals */}
            <ConfirmationModal show={showDeleteConfirm} title="ยืนยันการลบ" message="คุณแน่ใจหรือไม่ว่าต้องการลบการจองนี้?" onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} isProcessing={deleting} />
            <ConfirmationModal show={!!statusChangeInfo} title="ยืนยันการเปลี่ยนสถานะ" message={`เปลี่ยนสถานะเป็น "${statusChangeInfo?.statusLabel}"?`} onConfirm={confirmStatusChange} onCancel={() => setStatusChangeInfo(null)} isProcessing={updating} />
            <EditPaymentModal open={showEditPayment} onClose={() => setShowEditPayment(false)} onSave={handleSavePayment} defaultAmount={appointment.paymentInfo?.totalPrice} defaultMethod={appointment.paymentInfo?.paymentMethod} currencySymbol={profile?.currencySymbol} />
            <EditBookingModal open={showEditBooking} onClose={() => setShowEditBooking(false)} onSave={handleUpdateBooking} defaultData={appointment.bookingInfo} rooms={rooms} />
            <CheckoutModal
                open={showCheckoutModal}
                onClose={() => setShowCheckoutModal(false)}
                currencySymbol={profile?.currencySymbol}
                onConfirm={async (reason, fine, note) => {
                    if (!appointment?.id) return;
                    setUpdating(true);
                    try {
                        const token = await getAdminToken(); if (!token) return;
                        if (fine > 0) {
                            await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', {
                                amount: (appointment.paymentInfo?.totalPrice || 0) + fine,
                                method: appointment.paymentInfo?.paymentMethod || 'cash'
                            }, { adminToken: token });
                        }
                        const closingNote = `[Checkout: ${reason}] ${fine > 0 ? `(Fine: ${fine})` : ''} ${note}`.trim();
                        const result = await updateAppointmentStatusByAdmin(appointment.id, 'completed', closingNote, { adminToken: token });
                        if (result.success) showToast('เช็คเอาท์สำเร็จ', 'success');
                        else showToast(`ไม่สำเร็จ: ${result.error}`, 'error');
                    } catch (err: any) { showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error'); }
                    finally { setUpdating(false); setShowCheckoutModal(false); }
                }}
            />

            {/* ── Page Header ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-all"
                    >
                        <BackIcon />
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl font-bold text-gray-900">
                                การจอง #{appointment.id.substring(0, 6).toUpperCase()}
                            </h1>
                            <StatusBadge status={appointment.status} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            สร้างเมื่อ {appointment.createdAt ? format(appointment.createdAt as Date, 'd MMM yyyy, HH:mm', { locale: th }) : '-'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleting}
                    className="px-4 py-2 text-xs font-bold text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                    ลบการจอง
                </button>
            </div>

            {/* ── Content Grid ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── Left Column ──────────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Customer Info */}
                    <SectionCard title="ข้อมูลลูกค้า" icon={<UserIcon />}>
                        {/* Avatar + Name */}
                        {appointment.customerInfo?.pictureUrl && (
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-50">
                                <img src={appointment.customerInfo.pictureUrl} alt="" className="w-12 h-12 rounded-md object-cover border border-gray-100" />
                                <div>
                                    <p className="font-bold text-gray-900">{appointment.customerInfo?.fullName || appointment.customerInfo?.name}</p>
                                    <p className="text-xs text-gray-400">{appointment.customerInfo?.phone}</p>
                                </div>
                            </div>
                        )}
                        <InfoRow label="ชื่อลูกค้า" value={appointment.customerInfo?.fullName || appointment.customerInfo?.name} />
                        <InfoRow label="เบอร์โทร" value={appointment.customerInfo?.phone} />
                        <InfoRow
                            label="LINE"
                            value={appointment.userId
                                ? <span className="text-emerald-600 font-bold text-xs">เชื่อมต่อแล้ว ✓</span>
                                : <span className="text-gray-400 text-xs">ไม่ได้เชื่อมต่อ</span>}
                        />
                        <InfoRow label="หมายเหตุ" value={appointment.customerInfo?.note} />

                        {/* Status Actions */}
                        <div className="mt-5 pt-4 border-t border-gray-50">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">เปลี่ยนสถานะ</p>
                            <div className="flex flex-wrap gap-2">
                                {(appointment.status === 'confirmed' || appointment.status === 'awaiting_confirmation' || appointment.status === 'pending') && (
                                    <button
                                        onClick={() => handleStatusChange('in_progress')}
                                        disabled={updating}
                                        className="px-4 py-2 text-sm font-bold text-white bg-violet-600 rounded-md hover:bg-violet-700 shadow-sm transition-all disabled:opacity-50"
                                    >
                                        เช็คอิน ↗
                                    </button>
                                )}
                                {appointment.status === 'in_progress' && (
                                    <button
                                        onClick={() => setShowCheckoutModal(true)}
                                        disabled={updating}
                                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
                                    >
                                        เช็คเอาท์ ↗
                                    </button>
                                )}
                                {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                                    <button
                                        onClick={() => handleStatusChange('cancelled')}
                                        disabled={updating}
                                        className="px-3 py-2 text-xs font-bold text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-all disabled:opacity-50"
                                    >
                                        ยกเลิก
                                    </button>
                                )}
                            </div>
                        </div>
                    </SectionCard>

                    {/* Booking Info */}
                    <SectionCard
                        title="รายละเอียดการจอง"
                        icon={<CalIcon />}
                        action={
                            <button
                                onClick={() => setShowEditBooking(true)}
                                className="p-2 rounded-md border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
                            >
                                <EditIcon />
                            </button>
                        }
                    >
                        <InfoRow label="ห้องพัก" value={appointment.roomTypeInfo?.name || appointment.serviceInfo?.name} />
                        <InfoRow label="เลขห้อง" value={<span className="font-bold text-gray-900 text-base">{roomNumber}</span>} />
                        <InfoRow label="เช็คอิน" value={formatDisplayDate(appointment.bookingInfo?.checkInDate)} />
                        <InfoRow label="เช็คเอาท์" value={formatDisplayDate(appointment.bookingInfo?.checkOutDate)} />
                        <InfoRow label="จำนวนคืน" value={appointment.bookingInfo?.nights} />
                        <InfoRow label="จำนวนห้อง" value={appointment.bookingInfo?.rooms} />
                        <InfoRow label="ผู้เข้าพัก" value={(appointment.bookingInfo as any)?.guests} />
                        <InfoRow
                            label="วันที่สร้าง"
                            value={appointment.createdAt ? format(safeDate(appointment.createdAt)!, 'd MMM yyyy, HH:mm น.', { locale: th }) : '-'}
                        />
                        {appointment.completionNote && (
                            <div className="mt-4 pt-4 border-t border-gray-50">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ข้อมูลการเช็คเอาท์</p>
                                <div className="text-sm text-gray-600 bg-gray-50 p-3.5 rounded-md whitespace-pre-line border border-gray-100">
                                    {appointment.completionNote}
                                </div>
                            </div>
                        )}
                    </SectionCard>
                </div>

                {/* ── Right Column: Payment ─────────────────────────────── */}
                <div className="space-y-5">
                    <div className="sticky top-20 space-y-5">
                        <SectionCard title="การชำระเงิน" icon={<CardIcon />}>

                            {/* Price Breakdown */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">ค่าห้องพัก</span>
                                    <span className="text-gray-700 font-medium">{formatPrice(appointment.paymentInfo?.originalPrice || appointment.paymentInfo?.basePrice)} {profile?.currencySymbol}</span>
                                </div>
                                {appointment.paymentInfo?.discount ? (
                                    <div className="flex justify-between text-sm text-emerald-600">
                                        <span>ส่วนลด</span>
                                        <span>-{formatPrice(appointment.paymentInfo?.discount)} {profile?.currencySymbol}</span>
                                    </div>
                                ) : null}
                                <div className="border-t border-dashed border-gray-200 my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-gray-900">ยอดรวมสุทธิ</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xl text-gray-900">{formatPrice(appointment.paymentInfo?.totalPrice)}</span>
                                        <span className="text-xs text-gray-400">{profile?.currencySymbol}</span>
                                        <button onClick={() => setShowEditPayment(true)} className="text-gray-400 hover:text-gray-700 ml-1 transition-colors" title="แก้ไขราคา">
                                            <PencilIcon />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Status Info */}
                            <div className="bg-gray-50 rounded-md p-4 mb-4 border border-gray-100 space-y-0">
                                <InfoRow
                                    label="สถานะชำระ"
                                    value={
                                        payStatus === 'paid' ? <span className="text-emerald-600 font-bold text-xs">ชำระแล้ว ✓</span> :
                                            payStatus === 'pending_verification' ? <span className="text-amber-600 font-bold text-xs">รอตรวจสอบสลิป</span> :
                                                payStatus === 'invoiced' ? <span className="text-blue-600 font-bold text-xs">ส่งใบแจ้งหนี้แล้ว</span> :
                                                    <span className="text-gray-500 font-bold text-xs">รอชำระ</span>
                                    }
                                />
                                <InfoRow label="ช่องทาง" value={appointment.paymentInfo?.paymentMethod} />
                                {dueAt && <InfoRow label="ชำระภายใน" value={format(dueAt, 'd MMM yyyy, HH:mm', { locale: th })} />}
                                {(appointment.paymentInfo as any)?.paidAt && (
                                    <InfoRow label="ชำระเมื่อ" value={format(safeDate((appointment.paymentInfo as any).paidAt)!, 'd MMM HH:mm', { locale: th })} />
                                )}
                            </div>

                            {/* Payment Slip */}
                            <div className="rounded-md border border-gray-100 p-4 mb-4">
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">หลักฐานการชำระเงิน</p>
                                {loadingSlips ? (
                                    <div className="flex items-center justify-center py-4">
                                        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
                                    </div>
                                ) : paymentSlips.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-2">ยังไม่มีการแจ้งชำระเงินจากลูกค้า</p>
                                ) : (
                                    <div>
                                        <img
                                            src={paymentSlips[0].slipBase64}
                                            alt="Payment slip"
                                            className="w-full rounded-md border border-gray-100 object-contain bg-white mb-2"
                                        />
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <div className="flex justify-between">
                                                <span>อัปโหลดเมื่อ</span>
                                                <span className="font-medium text-gray-700">
                                                    {paymentSlips[0].createdAt ? format(new Date(paymentSlips[0].createdAt), 'd MMM yyyy, HH:mm', { locale: th }) : '-'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>สถานะสลิป</span>
                                                <span className="font-medium text-gray-700">{paymentSlips[0].status || 'submitted'}</span>
                                            </div>
                                        </div>
                                        {paymentSlips.length > 1 && (
                                            <p className="text-[10px] text-gray-400 mt-2">มีสลิปทั้งหมด {paymentSlips.length} รายการ (แสดงล่าสุด)</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-2.5">
                                {(appointment.status === 'awaiting_confirmation' || appointment.status === 'pending') && (
                                    <button
                                        onClick={handleConfirmPayment}
                                        disabled={updating}
                                        className="w-full py-3 text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
                                    >
                                        ยืนยันการชำระเงิน ✓
                                    </button>
                                )}
                                <button
                                    onClick={handleSendInvoice}
                                    disabled={isSendingInvoice || payStatus === 'paid'}
                                    className="w-full py-3 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400"
                                >
                                    {isSendingInvoice ? 'กำลังส่ง...' : 'ส่งลิงก์ชำระเงิน'}
                                </button>
                                <button
                                    onClick={() => setShowEditPayment(true)}
                                    className="w-full py-3 text-sm font-semibold text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    บันทึกการชำระเงิน (Manual)
                                </button>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    );
}
