"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, auth } from '@/app/lib/firebase';
import { doc, getDoc, getDocs, collection, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updateAppointmentStatusByAdmin, confirmAppointmentAndPaymentByAdmin, sendInvoiceToCustomer } from '@/app/actions/appointmentActions';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

// --- Icons ---
const Icons = {
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    CreditCard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
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

interface CheckoutModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (reason: string, fineAmount: number, note: string) => Promise<void>;
    currencySymbol?: string;
}

function CheckoutModal({ open, onClose, onConfirm, currencySymbol }: CheckoutModalProps) {
    const [reason, setReason] = useState('ปกติ');
    const [fine, setFine] = useState<string>('');
    const [note, setNote] = useState('');
    const [processing, setProcessing] = useState(false);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">รายละเอียดการเช็คเอาท์</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">สาเหตุการออก</label>
                        <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={reason} onChange={e => setReason(e.target.value)}>
                            <option value="ปกติ">ครบกำหนด (ปกติ)</option>
                            <option value="ออกก่อนกำหนด">ลูกค้าแจ้งออกก่อนกำหนด</option>
                            <option value="ผิดระเบียบ">ให้ออก (ผิดระเบียบ)</option>
                            <option value="เหตุสุดวิสัย">เหตุสุดวิสัย</option>
                            <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ค่าปรับ / ค่าเสียหาย ({currencySymbol})</label>
                        <input
                            type="number"
                            placeholder="0.00"
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            value={fine}
                            onChange={e => setFine(e.target.value)}
                            min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">ระบุหากมีค่าปรับหรือค่าเสียหายเพิ่มเติม</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                        <textarea
                            rows={3}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            placeholder="รายละเอียดเพิ่มเติม..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">ยกเลิก</button>
                    <button
                        onClick={async () => {
                            setProcessing(true);
                            await onConfirm(reason, Number(fine) || 0, note);
                            setProcessing(false);
                            onClose();
                        }}
                        disabled={processing}
                        className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {processing ? 'กำลังบันทึก...' : 'ยืนยันเช็คเอาท์'}
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
        awaiting_confirmation: { label: 'รอชำระภายในวันนี้', bg: 'bg-yellow-100', text: 'text-yellow-800' },
        pending: { label: 'รอชำระภายในวันนี้', bg: 'bg-yellow-100', text: 'text-yellow-800' },
        confirmed: { label: 'ชำระแล้ว', bg: 'bg-blue-100', text: 'text-blue-800' },
        in_progress: { label: 'เช็คอินแล้ว', bg: 'bg-purple-100', text: 'text-purple-800' },
        completed: { label: 'เช็คเอาท์แล้ว', bg: 'bg-green-100', text: 'text-green-800' },
        cancelled: { label: 'ยกเลิก', bg: 'bg-red-100', text: 'text-red-800' },
        blocked: { label: 'ห้องไม่ว่าง', bg: 'bg-gray-100', text: 'text-gray-800' },
    };
    const current = config[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-800' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${current.bg} ${current.text}`}>{current.label}</span>;
};

const STATUS_OPTIONS = [
    { value: 'awaiting_confirmation', label: 'รอชำระ' },
    { value: 'pending', label: 'รอชำระ' },
    { value: 'confirmed', label: 'ชำระแล้ว' },
    { value: 'in_progress', label: 'เช็คอินแล้ว' },
    { value: 'completed', label: 'เช็คเอาท์แล้ว' },
    { value: 'cancelled', label: 'ยกเลิก' },
];

const formatPrice = (v: number | undefined) => v == null ? '-' : Number(v).toLocaleString();
const safeDate = (d: any) => { if (!d) return null; if (typeof d.toDate === 'function') return d.toDate(); return new Date(d); };
const formatDisplayDate = (d: string | undefined | null) => {
    if (!d) return '-';
    try {
        // Assume YYYY-MM-DD input
        const [y, m, d_] = d.split('-');
        if (y && m && d_) return `${d_}-${m}-${y}`;
        return d;
    } catch { return d; }
};

interface EditBookingModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    defaultData: any;
    rooms: any[];
}

function EditBookingModal({ open, onClose, onSave, defaultData, rooms }: EditBookingModalProps) {
    const [formData, setFormData] = useState(defaultData || {});
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (defaultData) {
            setFormData({
                ...defaultData,
                roomId: defaultData.roomId || '' // Ensure roomId is controlled
            });
        }
    }, [defaultData]);

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">แก้ไขข้อมูลการจอง</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ห้องพัก</label>
                        <select name="roomId" value={formData.roomId} onChange={handleChange} className="w-full border rounded px-3 py-2 text-sm bg-white">
                            <option value="">-- ไม่ระบุห้อง --</option>
                            {rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.number} {r.type ? `(${r.type})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เช็คอิน</label>
                            <input type="date" name="checkInDate" value={formData.checkInDate || ''} onChange={handleChange} className="w-full border rounded px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เช็คเอาท์</label>
                            <input type="date" name="checkOutDate" value={formData.checkOutDate || ''} onChange={handleChange} className="w-full border rounded px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เข้าพัก</label>
                        <input type="number" name="guests" value={formData.guests || 1} onChange={handleChange} className="w-full border rounded px-3 py-2 text-sm" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">ยกเลิก</button>
                    <button onClick={async () => { setProcessing(true); await onSave(formData); setProcessing(false); onClose(); }} disabled={processing} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        {processing ? 'บันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Main Component ---
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
    const [statusChangeInfo, setStatusChangeInfo] = useState<{ newStatus: string, statusLabel: string } | null>(null);
    const [isSendingInvoice, setIsSendingInvoice] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const [roomNumber, setRoomNumber] = useState<string>('-');
    const [rooms, setRooms] = useState<any[]>([]); // Add rooms state
    const [showEditBooking, setShowEditBooking] = useState(false);
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast("ไม่พบการยืนยันตัวตน", "error");
            return null;
        }
        return token;
    };

    useEffect(() => {
        if (!id || deleted) return;
        setLoading(true);
        const unsub = onSnapshot(doc(db, 'appointments', id), async (snap) => {
            if (!snap.exists()) { showToast('ไม่พบข้อมูล', 'error'); setAppointment(null); setLoading(false); return; }
            const raw = snap.data();
            const appData = { id: snap.id, ...raw, createdAt: safeDate(raw.createdAt), updatedAt: safeDate(raw.updatedAt) } as any;

            // Fetch Room Number if roomId exists
            let roomNo = '-';
            if (appData.bookingInfo?.roomId) {
                try {
                    const roomSnap = await getDoc(doc(db, 'rooms', appData.bookingInfo.roomId));
                    if (roomSnap.exists()) {
                        roomNo = roomSnap.data().number;
                    }
                } catch (e) {
                    console.error("Error fetching room:", e);
                }
            } else if (appData.bookingInfo?.roomNumber) {
                // Determine if roomNumber is stored directly
                roomNo = appData.bookingInfo.roomNumber;
            }

            setRoomNumber(roomNo);
            setAppointment(appData);
            setLoading(false);
        });
        return () => unsub();
    }, [id, deleted, showToast]);

    useEffect(() => {
        getDocs(collection(db, 'rooms')).then(snap => {
            setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (a.number || '').localeCompare(b.number || '')));
        }).catch(err => console.error(err));
    }, []);

    const handleUpdateBooking = async (data: any) => {
        if (!appointment?.id) return;
        try {
            const token = await getAdminToken();
            if (!token) return;

            let newRoomNumber = roomNumber;
            // Resolve room number from selected roomId
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
            setShowEditBooking(false);
        } catch (error: any) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        }
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
        setStatusChangeInfo({ newStatus, statusLabel: STATUS_OPTIONS.find(o => o.value === newStatus)?.label || newStatus });
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



    if (deleted) return <div className="flex justify-center items-center min-h-[400px] text-gray-500">กำลังกลับสู่หน้าหลัก...</div>;
    if (loading || profileLoading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;
    if (!appointment) return <div className="flex justify-center items-center min-h-[400px] text-gray-500">ไม่พบข้อมูลการจอง</div>;

    const dateTime = safeDate(appointment.appointmentInfo?.dateTime || appointment.date);
    const dueAt = safeDate(appointment.paymentInfo?.paymentDueAt);

    return (
        <div className="max-w-5xl mx-auto p-6">
            <ConfirmationModal show={showDeleteConfirm} title="ยืนยันการลบ" message="คุณแน่ใจหรือไม่ว่าต้องการลบการจองนี้?" onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} isProcessing={deleting} />
            <ConfirmationModal show={!!statusChangeInfo} title="ยืนยันการเปลี่ยนสถานะ" message={`เปลี่ยนสถานะเป็น "${statusChangeInfo?.statusLabel}"?`} onConfirm={confirmStatusChange} onCancel={() => setStatusChangeInfo(null)} isProcessing={updating} />
            <EditPaymentModal open={showEditPayment} onClose={() => setShowEditPayment(false)} onSave={handleSavePayment} defaultAmount={appointment.paymentInfo?.totalPrice} defaultMethod={appointment.paymentInfo?.paymentMethod} currencySymbol={profile.currencySymbol} />
            <EditBookingModal open={showEditBooking} onClose={() => setShowEditBooking(false)} onSave={handleUpdateBooking} defaultData={appointment.bookingInfo} rooms={rooms} />
            <CheckoutModal
                open={showCheckoutModal}
                onClose={() => setShowCheckoutModal(false)}
                currencySymbol={profile.currencySymbol}
                onConfirm={async (reason, fine, note) => {
                    if (!appointment?.id) return;
                    setUpdating(true);
                    try {
                        const token = await getAdminToken();
                        if (!token) return;

                        // 1. Process Fine (if any) by updating payment total
                        if (fine > 0) {
                            // Ideally, we should have a specific API for adding fines/adjustments.
                            // For now, we reuse the payment update or specific status update payload if supported.
                            // Or simpler: Just update the totalPrice in frontend logic and send adjustment request.
                            // Let's assume we pass this info as part of the status update payload if the API supports it,
                            // OR we create a "fine" transaction.

                            // Since current action is simple, let's update status with note including fine detail.
                            // Better: call update payment to add fine to total.
                            await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', {
                                amount: (appointment.paymentInfo?.totalPrice || 0) + fine,
                                method: appointment.paymentInfo?.paymentMethod || 'cash' // Keep existing method
                            }, { adminToken: token });
                        }

                        // 2. Update Status to Completed
                        // We append Checkout Reason & Note to the appointment note or a specific field
                        const closingNote = `[Checkout: ${reason}] ${fine > 0 ? `(Fine: ${fine})` : ''} ${note}`.trim();

                        const result = await updateAppointmentStatusByAdmin(appointment.id, 'completed', closingNote, { adminToken: token });

                        // We might want to save the closing note specifically. 
                        // If updateAppointmentStatusByAdmin doesn't support notes directly, we might need a separate update.
                        // For now, let's assume successful status change is the priority.

                        if (result.success) showToast('เช็คเอาท์สำเร็จ', 'success');
                        else showToast(`ไม่สำเร็จ: ${result.error}`, 'error');

                    } catch (err: any) {
                        showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
                    } finally {
                        setUpdating(false);
                        setShowCheckoutModal(false);
                    }
                }}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-md text-gray-500"><Icons.Back /></button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold text-gray-900">การจองห้องพัก #{appointment.id.substring(0, 6).toUpperCase()}</h1>
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

                            {/* Status Actions */}
                            <div className="mt-6 pt-4 border-t">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-3">เปลี่ยนสถานะ</p>
                                <div className="flex flex-wrap gap-2">
                                    {/* Primary Action Button */}

                                    {(appointment.status === 'confirmed' || appointment.status === 'awaiting_confirmation' || appointment.status === 'pending') && (
                                        <button onClick={() => handleStatusChange('in_progress')} disabled={updating} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 shadow-sm">
                                            เช็คอิน (Check-in)
                                        </button>
                                    )}
                                    {appointment.status === 'in_progress' && (
                                        <button onClick={() => setShowCheckoutModal(true)} disabled={updating} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm">
                                            เช็คเอาท์ (Check-out)
                                        </button>
                                    )}

                                    {/* Secondary Action: Cancel Only */}
                                    {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                                        <button onClick={() => handleStatusChange('cancelled')} disabled={updating} className="px-3 py-2 text-xs font-medium text-red-600 bg-white border border-gray-300 rounded-md hover:bg-red-50 hover:border-red-300">
                                            ยกเลิก (Cancel)
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Room Booking Info */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icons.Calendar />
                                <h2 className="text-sm font-semibold text-gray-900">รายละเอียดการจองห้องพัก</h2>
                            </div>
                            <button onClick={() => setShowEditBooking(true)} className="text-gray-400 hover:text-blue-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                        </div>
                        <div className="p-5">
                            <InfoRow label="ห้องพัก" value={appointment.roomTypeInfo?.name || appointment.serviceInfo?.name || '-'} />
                            <InfoRow label="เลขห้อง" value={<span className="font-semibold text-gray-900">{roomNumber}</span>} />
                            <InfoRow label="เช็คอิน" value={formatDisplayDate(appointment.bookingInfo?.checkInDate)} />
                            <InfoRow label="เช็คเอาท์" value={formatDisplayDate(appointment.bookingInfo?.checkOutDate)} />
                            <InfoRow label="จำนวนคืน" value={appointment.bookingInfo?.nights || '-'} />
                            <InfoRow label="จำนวนห้อง" value={appointment.bookingInfo?.rooms || '-'} />
                            <InfoRow label="ผู้เข้าพัก" value={(appointment.bookingInfo as any)?.guests || '-'} />
                            <InfoRow label="วันที่สร้างรายการ" value={appointment.createdAt ? format(safeDate(appointment.createdAt)!, 'd MMM yyyy, HH:mm น.', { locale: th }) : '-'} />
                            {appointment.completionNote && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-sm font-medium text-gray-900 mb-2">ข้อมูลการเช็คเอาท์</p>
                                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md whitespace-pre-line border border-gray-100">
                                        {appointment.completionNote}
                                    </div>
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
                                    <span className="text-gray-600">ค่าห้องพัก</span>
                                    <span className="text-gray-900">{formatPrice(appointment.paymentInfo?.originalPrice || appointment.paymentInfo?.basePrice)} {profile.currencySymbol}</span>
                                </div>
                                {appointment.paymentInfo?.discount ? (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>ส่วนลด</span>
                                        <span>-{formatPrice(appointment.paymentInfo?.discount)} {profile.currencySymbol}</span>
                                    </div>
                                ) : null}
                                <div className="border-t border-dashed my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-900">ยอดรวมสุทธิ</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg text-gray-900">{formatPrice(appointment.paymentInfo?.totalPrice)} <span className="text-sm font-normal text-gray-500">{profile.currencySymbol}</span></span>
                                        <button onClick={() => setShowEditPayment(true)} className="text-blue-600 hover:text-blue-800" title="แก้ไขราคา/ค่าปรับ">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-md p-4 mb-4">
                                <InfoRow label="สถานะ" value={
                                    appointment.paymentInfo?.paymentStatus === 'paid' ? <span className="text-green-600 font-medium">ชำระแล้ว</span> :
                                        appointment.paymentInfo?.paymentStatus === 'invoiced' ? <span className="text-blue-600 font-medium">ส่งใบแจ้งหนี้แล้ว</span> :
                                            <span className="text-yellow-600 font-medium">รอชำระ</span>
                                } />
                                <InfoRow label="ช่องทาง" value={appointment.paymentInfo?.paymentMethod} />
                                {dueAt && (
                                    <InfoRow label="ชำระภายใน" value={format(dueAt, 'd MMM yyyy, HH:mm', { locale: th })} />
                                )}
                                {(appointment.paymentInfo as any)?.paidAt && (
                                    <InfoRow label="ชำระเมื่อ" value={format(safeDate((appointment.paymentInfo as any).paidAt), 'd MMM HH:mm', { locale: th })} />
                                )}
                            </div>

                            <div className="space-y-2">
                                {(appointment.status === 'awaiting_confirmation' || appointment.status === 'pending') && (
                                    <button onClick={() => handleStatusChange('confirmed')} disabled={updating} className="w-full py-2.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm">
                                        ยืนยันการชำระเงิน (Confirm)
                                    </button>
                                )}
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
