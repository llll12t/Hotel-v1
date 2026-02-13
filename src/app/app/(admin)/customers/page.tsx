"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/app/lib/firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/app/components/Toast";
import { ConfirmationModal } from "@/app/components/common/NotificationComponent";
import { addCustomer, deleteCustomer } from "@/app/actions/customerActions";
import { Customer } from "@/types";

// --- Icons ---
const Icons = {
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Mail: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    Star: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    Line: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 10.2c0-4.6-4.3-8.2-9.5-8.2S2.5 5.6 2.5 10.2c0 4.1 3.4 7.5 8 8.1.3 0 .7.1.8.3.1.2.1.5 0 .8-.1.4-.3 1.4-.3 1.7 0 .5.3.9.9.5l5.2-3.6c2.7-1.4 4.4-4.2 4.4-7.8zM12 14.6c-3.6 0-6.6-2.5-6.6-5.6 0-3.1 3-5.6 6.6-5.6 3.6 0 6.6 2.5 6.6 5.6 0 3.1-3 5.6-6.6 5.6z" /></svg>,
    X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
};

// --- Customer Form Modal (Add/Edit) ---
interface CustomerFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    customer: Customer | null;
}

function CustomerFormModal({ open, onClose, onSave, customer }: CustomerFormModalProps) {
    const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', points: 0, userId: '' });
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const isEdit = !!customer;

    useEffect(() => {
        if (customer) {
            setFormData({
                fullName: customer.fullName || '',
                phone: customer.phone || '',
                email: customer.email || '',
                points: customer.points || 0,
                userId: customer.userId || ''
            });
        } else {
            setFormData({ fullName: '', phone: '', email: '', points: 0, userId: '' });
        }
    }, [customer, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => showToast('คัดลอก LINE User ID แล้ว!', 'success'));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone) {
            showToast("กรุณากรอกชื่อและเบอร์โทรศัพท์", "error");
            return;
        }
        setSaving(true);
        try {
            if (isEdit && customer?.id) {
                await updateDoc(doc(db, "customers", customer.id), {
                    fullName: formData.fullName,
                    phone: formData.phone,
                    email: formData.email,
                    points: Number(formData.points),
                    updatedAt: new Date()
                });
                showToast("อัปเดตข้อมูลลูกค้าสำเร็จ!", "success");
            } else {
                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    showToast("ไม่พบการยืนยันตัวตน", "error");
                    setSaving(false);
                    return;
                }
                const result = await addCustomer(formData, { adminToken: token });
                if (!result.success) throw new Error(result.error);
                showToast(result.message || "เพิ่มลูกค้าสำเร็จ", 'success');
            }
            onSave();
            onClose();
        } catch (error: any) {
            showToast("เกิดข้อผิดพลาด: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md text-gray-500"><Icons.X /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* LINE ID Section */}
                    {isEdit && formData.userId && (
                        <div className="bg-green-50 rounded-md p-3 border border-green-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-green-100 text-green-600 rounded-md"><Icons.Line /></div>
                                <div>
                                    <p className="text-xs font-medium text-green-800">LINE User ID</p>
                                    <p className="text-xs font-mono text-green-700">{formData.userId}</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => copyToClipboard(formData.userId)} className="px-2 py-1 bg-white text-green-600 text-xs font-medium rounded border border-green-200 hover:bg-green-50">Copy</button>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
                            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required className={inputClass} placeholder="ระบุชื่อลูกค้า" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ *</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className={inputClass} placeholder="08x-xxx-xxxx" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="example@mail.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">คะแนนสะสม</label>
                            <input type="number" name="points" value={formData.points} onChange={handleChange} className={inputClass} placeholder="0" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50">ยกเลิก</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const { showToast } = useToast();

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        } catch { showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchCustomers(); }, []);

    const confirmDelete = async () => {
        if (!customerToDelete?.id) return;
        setIsDeleting(true);
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast("ไม่พบการยืนยันตัวตน", "error");
            setIsDeleting(false);
            return;
        }
        const result = await deleteCustomer(customerToDelete.id, { adminToken: token });
        if (result.success) {
            showToast(result.message || 'ลบสำเร็จ', 'success');
            fetchCustomers();
        } else {
            showToast(result.error || 'ลบไม่สำเร็จ', 'error');
        }
        setIsDeleting(false);
        setCustomerToDelete(null);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => showToast('คัดลอก LINE User ID แล้ว!', 'success'));
    };

    const openAddModal = () => { setEditingCustomer(null); setShowFormModal(true); };
    const openEditModal = (customer: Customer) => { setEditingCustomer(customer); setShowFormModal(true); };

    const filtered = customers.filter(c => {
        const q = search.trim().toLowerCase();
        return !q || (c.fullName?.toLowerCase().includes(q)) || (c.phone?.includes(q)) || (c.email?.toLowerCase().includes(q));
    });

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ConfirmationModal show={!!customerToDelete} title="ยืนยันการลบ" message={`คุณแน่ใจหรือไม่ว่าต้องการลบลูกค้า "${customerToDelete?.fullName}"?`} onConfirm={confirmDelete} onCancel={() => setCustomerToDelete(null)} isProcessing={isDeleting} />
            <CustomerFormModal open={showFormModal} onClose={() => setShowFormModal(false)} onSave={fetchCustomers} customer={editingCustomer} />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">ลูกค้าทั้งหมด</h1>
                    <p className="text-sm text-gray-500">จัดการข้อมูลลูกค้าและประวัติการใช้งาน</p>
                </div>
                <button onClick={openAddModal} className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors">
                    <Icons.Plus /> เพิ่มลูกค้าใหม่
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <div className="relative w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
                    <input type="text" placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex items-center gap-1 bg-white border rounded-md p-1 ml-auto">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.Grid /></button>
                    <button onClick={() => setViewMode('table')} className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.List /></button>
                </div>
            </div>

            {/* Content */}
            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.User /></div>
                    <p className="text-gray-600 font-medium">ไม่พบข้อมูลลูกค้า</p>
                    <p className="text-sm text-gray-400 mt-1">ลองค้นหาใหม่หรือเพิ่มลูกค้าใหม่</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map(customer => (
                        <div key={customer.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                                    {customer.fullName?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-gray-900 truncate">{customer.fullName}</h3>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Icons.Phone />
                                        <span className="truncate">{customer.phone || '-'}</span>
                                    </div>
                                </div>
                                {customer.userId && (
                                    <button onClick={() => copyToClipboard(customer.userId!)} className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100" title="Copy LINE ID">
                                        <Icons.Line />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                <Icons.Mail />
                                <span className="truncate">{customer.email || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded w-fit mb-3">
                                <Icons.Star />
                                <span>{customer.points || 0} คะแนน</span>
                            </div>
                            <div className="flex items-center justify-end gap-1 pt-3 border-t">
                                <button onClick={() => openEditModal(customer)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border"><Icons.Edit /></button>
                                <button onClick={() => setCustomerToDelete(customer)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md border"><Icons.Trash /></button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อลูกค้า</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อีเมล</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">คะแนน</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LINE</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filtered.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.fullName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{c.phone || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{c.email || '-'}</td>
                                    <td className="px-6 py-4"><span className="text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded text-sm">{c.points || 0}</span></td>
                                    <td className="px-6 py-4">
                                        {c.userId ? (
                                            <button onClick={() => copyToClipboard(c.userId!)} className="text-green-600 hover:text-green-700"><Icons.Line /></button>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => openEditModal(c)} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</button>
                                        <button onClick={() => setCustomerToDelete(c)} className="text-red-600 hover:underline text-sm">ลบ</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
