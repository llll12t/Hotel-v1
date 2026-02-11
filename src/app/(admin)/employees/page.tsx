"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { fetchEmployees, deleteEmployee, updateEmployeeStatus, promoteEmployeeToAdmin } from '@/app/actions/employeeActions';
import { fetchAdmins, deleteAdmin } from '@/app/actions/adminActions';
import { auth, db } from '@/app/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { Employee } from '@/types';

// ============ MODAL ============
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}
const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/50" onClick={onClose} />
                <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="p-6">{children}</div>
                </div>
            </div>
        </div>
    );
};

// ============ IMAGE UPLOADER ============
interface ImageUploaderProps {
    value?: string;
    onChange: (url: string) => void;
    color?: 'blue' | 'purple';
}
const ImageUploader = ({ value, onChange, color = 'blue' }: ImageUploaderProps) => {
    const [preview, setPreview] = useState<string | null>(value || null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const id = `photo-${Math.random().toString(36).substr(2, 9)}`;
    useEffect(() => { setPreview(value || null); }, [value]);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { alert('ไฟล์ต้องไม่เกิน 2MB'); return; }
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreview(result);
                onChange(result);
            };
            reader.readAsDataURL(file);
        }
    };
    const clear = () => { setPreview(null); onChange(''); if (fileInputRef.current) fileInputRef.current.value = ''; };
    const bgColor = color === 'purple' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200';
    const iconColor = color === 'purple' ? 'text-purple-400' : 'text-blue-400';
    const linkColor = color === 'purple' ? 'text-purple-600' : 'text-blue-600';

    return (
        <div className="flex items-center gap-4">
            {preview ? (
                <div className="relative">
                    <Image src={preview} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover border" unoptimized />
                    <button type="button" onClick={clear} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs">�</button>
                </div>
            ) : (
                <div className={`w-16 h-16 rounded-full ${bgColor} border-2 border-dashed flex items-center justify-center`}>
                    <svg className={`w-6 h-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
            )}
            <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id={id} />
                <label htmlFor={id} className={`text-sm ${linkColor} hover:underline cursor-pointer`}>{preview ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</label>
                <p className="text-xs text-gray-500">PNG, JPG ไม่เกิน 2MB</p>
            </div>
        </div>
    );
};

// ============ PERSON FORM ============
interface PersonFormProps {
    person: Employee | null;
    type: 'employee' | 'admin';
    onSave: (form: any, isEdit: boolean) => void;
    onCancel: () => void;
    loading: boolean;
}
const PersonForm = ({ person, type, onSave, onCancel, loading }: PersonFormProps) => {
    const isEdit = !!person;
    const isAdmin = type === 'admin';
    const [form, setForm] = useState({
        firstName: person?.firstName || '', lastName: person?.lastName || '',
        phone: person?.phoneNumber || '', email: person?.email || '', password: '',
        lineUserId: person?.lineUserId || '', status: person?.status || 'available', photoURL: person?.photoURL || ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [e.target.name]: e.target.value });
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(form, isEdit); };
    const btnColor = isAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700';

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <ImageUploader value={form.photoURL} onChange={(url) => setForm({ ...form, photoURL: url })} color={isAdmin ? 'purple' : 'blue'} />
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">ชื่อจริง *</label><input name="firstName" value={form.firstName} onChange={handleChange} required className="w-full px-3 py-2 border rounded-md text-sm text-gray-900" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล</label><input name="lastName" value={form.lastName} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm text-gray-900" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร *</label><input name="phone" value={form.phone} onChange={handleChange} required className="w-full px-3 py-2 border rounded-md text-sm text-gray-900" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">LINE ID</label><input name="lineUserId" value={form.lineUserId} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm text-gray-900" /></div>
            </div>
            {!isEdit && (
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">อีเมล *</label><input type="email" name="email" value={form.email} onChange={handleChange} required className="w-full px-3 py-2 border rounded-md text-sm text-gray-900" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน *</label><input type="password" name="password" value={form.password} onChange={handleChange} required className="w-full px-3 py-2 border rounded-md text-sm text-gray-900" placeholder="อย่างน้อย 6 ตัว" /></div>
                </div>
            )}
            {!isAdmin && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                    <select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-md text-sm bg-white text-gray-900">
                        <option value="available">พร้อมทำงาน</option><option value="on_leave">ลาพัก</option><option value="suspended">พักงาน</option>
                    </select>
                </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">ยกเลิก</button>
                <button type="submit" disabled={loading} className={`px-4 py-2 text-sm text-white rounded-md disabled:bg-gray-400 ${btnColor}`}>
                    {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : isAdmin ? 'เพิ่มผู้ดูแลระบบ' : 'เพิ่มพนักงาน'}
                </button>
            </div>
        </form>
    );
};

// ============ PERSON DETAIL ============
interface PersonDetailProps {
    person: Employee;
    type: 'employee' | 'admin';
    onEdit: () => void;
    onPromote: () => void;
    promoting: boolean;
}
const PersonDetail = ({ person, type, onEdit, onPromote, promoting }: PersonDetailProps) => {
    const isAdmin = type === 'admin';
    const bgColor = isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
    const statusColors: Record<string, string> = { available: 'bg-green-100 text-green-800', on_leave: 'bg-yellow-100 text-yellow-800', suspended: 'bg-red-100 text-red-800' };
    const statusText: Record<string, string> = { available: 'พร้อมทำงาน', on_leave: 'ลาพัก', suspended: 'พักงาน' };

    return (
        <div className="text-center">
            {person.photoURL ? <Image src={person.photoURL} alt="" width={80} height={80} className="w-20 h-20 rounded-full object-cover mx-auto border" unoptimized />
                : <div className={`w-20 h-20 rounded-full ${bgColor} flex items-center justify-center mx-auto text-2xl font-medium`}>{person.firstName?.charAt(0)}</div>}
            <h3 className="text-lg font-semibold mt-3">{person.firstName} {person.lastName}</h3>
            <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${isAdmin ? 'bg-purple-100 text-purple-800' : statusColors[person.status || 'available'] || 'bg-gray-100'}`}>
                {isAdmin ? 'ผู้ดูแลระบบ' : statusText[person.status || 'available'] || person.status}
            </span>
            <div className="text-left mt-6 space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b"><span className="text-gray-500">เบอร์โทร</span><span className="text-gray-900">{person.phoneNumber || '-'}</span></div>
                <div className="flex justify-between py-2 border-b"><span className="text-gray-500">อีเมล</span><span className="text-gray-900">{person.email || '-'}</span></div>
                <div className="flex justify-between py-2"><span className="text-gray-500">LINE ID</span><span className="text-gray-900">{person.lineUserId || '-'}</span></div>
            </div>
            <div className="flex gap-3 mt-6">
                {!isAdmin && <button onClick={onPromote} disabled={promoting} className="flex-1 px-3 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400">{promoting ? 'กำลังดำเนินการ...' : 'เลื่อนเป็น Admin'}</button>}
                <button onClick={onEdit} className={`flex-1 px-3 py-2 text-sm text-white rounded-md ${isAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>แก้ไข</button>
            </div>
        </div>
    );
};

// ============ MAIN PAGE ============
export default function StaffPage() {
    const [tab, setTab] = useState<'employee' | 'admin'>('employee');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [admins, setAdmins] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [promoting, setPromoting] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
    const [selected, setSelected] = useState<Employee | null>(null);
    const [toDelete, setToDelete] = useState<Employee | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showToast } = useToast();

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast('ไม่พบการยืนยันตัวตน', 'error');
            return null;
        }
        return token;
    };

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const token = await getAdminToken();
        if (!token) {
            setLoading(false);
            return;
        }
        const [empRes, admRes] = await Promise.all([
            fetchEmployees({ adminToken: token }),
            fetchAdmins({ adminToken: token })
        ]);
        if (empRes.success) setEmployees(empRes.employees);
        if (admRes.success) setAdmins(admRes.admins);
        setLoading(false);
    };

    const closeModal = () => { setModalMode(null); setSelected(null); };
    const isAdmin = tab === 'admin';
    const data = isAdmin ? admins : employees;
    const collectionName = isAdmin ? 'admins' : 'employees';

    const handleSave = async (form: any, isEdit: boolean) => {
        if (!isEdit && (!form.firstName || !form.phone || !form.email || !form.password)) { showToast('กรุณากรอกข้อมูลที่จำเป็น', 'error'); return; }
        if (!isEdit && form.password.length < 6) { showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัว', 'error'); return; }
        setSaving(true);
        try {
            if (isEdit && selected) {
                const updateData: any = { firstName: form.firstName, lastName: form.lastName, phoneNumber: form.phone, lineUserId: form.lineUserId, photoURL: form.photoURL || null, updatedAt: new Date() };
                if (!isAdmin) updateData.status = form.status;
                await updateDoc(doc(db, collectionName, selected.id), updateData);
                showToast('บันทึกสำเร็จ', 'success');
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
                const user = userCredential.user;
                await updateProfile(user, { displayName: `${form.firstName} ${form.lastName}`.trim(), photoURL: form.photoURL || null });
                const saveData: any = { uid: user.uid, firstName: form.firstName, lastName: form.lastName, phoneNumber: form.phone, email: user.email, lineUserId: form.lineUserId, photoURL: form.photoURL || null, createdAt: serverTimestamp() };
                if (isAdmin) saveData.role = 'admin'; else saveData.status = form.status;
                await setDoc(doc(db, collectionName, user.uid), saveData);
                showToast(isAdmin ? 'เพิ่มผู้ดูแลระบบสำเร็จ' : 'เพิ่มพนักงานสำเร็จ', 'success');
            }
            closeModal(); loadData();
        } catch (error: any) {
            showToast(error.code === 'auth/email-already-in-use' ? 'อีเมลนี้ถูกใช้แล้ว' : 'เกิดข้อผิดพลาด', 'error');
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!toDelete?.id) return;
        setIsDeleting(true);
        const token = await getAdminToken();
        if (!token) {
            setIsDeleting(false);
            return;
        }
        const result = isAdmin
            ? await deleteAdmin(toDelete.id, { adminToken: token })
            : await deleteEmployee(toDelete.id, { adminToken: token });
        if (result.success) { showToast('ลบสำเร็จ', 'success'); loadData(); }
        else showToast('ลบไม่สำเร็จ', 'error');
        setIsDeleting(false); setToDelete(null);
    };

    const handlePromote = async () => {
        if (!selected) return;
        setPromoting(true);
        const token = await getAdminToken();
        if (!token) {
            setPromoting(false);
            return;
        }
        const result = await promoteEmployeeToAdmin(selected.id, { adminToken: token });
        if (result.success) { showToast('เลื่อนตำแหน่งสำเร็จ', 'success'); closeModal(); loadData(); }
        else showToast('เกิดข้อผิดพลาด', 'error');
        setPromoting(false);
    };

    const handleStatusChange = async (id: string, status: string) => {
        const token = await getAdminToken();
        if (!token) return;
        const result = await updateEmployeeStatus(id, status, { adminToken: token });
        if (result.success) { showToast('อัพเดทสถานะสำเร็จ', 'success'); loadData(); }
    };

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    const btnColor = isAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700';
    const textColor = isAdmin ? 'text-purple-600' : 'text-blue-600';

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ConfirmationModal show={!!toDelete} title="ยืนยันการลบ" message={`ลบ "${toDelete?.firstName}" ?`} onConfirm={handleDelete} onCancel={() => setToDelete(null)} isProcessing={isDeleting} />
            <Modal isOpen={modalMode === 'add' || modalMode === 'edit'} onClose={closeModal} title={modalMode === 'add' ? (isAdmin ? 'เพิ่มผู้ดูแลระบบ' : 'เพิ่มพนักงาน') : 'แก้ไขข้อมูล'}>
                <PersonForm person={modalMode === 'edit' ? selected : null} type={tab} onSave={handleSave} onCancel={closeModal} loading={saving} />
            </Modal>
            <Modal isOpen={modalMode === 'view'} onClose={closeModal} title="รายละเอียด">
                {selected && <PersonDetail person={selected} type={tab} onEdit={() => setModalMode('edit')} onPromote={handlePromote} promoting={promoting} />}
            </Modal>

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">จัดการบุคลากร</h1>
                <button onClick={() => setModalMode('add')} className={`px-4 py-2 text-sm font-medium text-white rounded-md ${btnColor}`}>
                    + {isAdmin ? 'เพิ่มผู้ดูแลระบบ' : 'เพิ่มพนักงาน'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b mb-6">
                <button onClick={() => setTab('employee')} className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'employee' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    พนักงาน ({employees.length})
                </button>
                <button onClick={() => setTab('admin')} className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'admin' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    ผู้ดูแลระบบ ({admins.length})
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ติดต่อ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{isAdmin ? 'วันที่สร้าง' : 'สถานะ'}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {data.map((person) => (
                            <tr key={person.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelected(person); setModalMode('view'); }}>
                                        {person.photoURL ? <Image src={person.photoURL} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" unoptimized />
                                            : <div className={`w-10 h-10 rounded-full ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center text-sm font-medium`}>{person.firstName?.charAt(0)}</div>}
                                        <div>
                                            <div className={`text-sm font-medium text-gray-900 hover:${textColor}`}>{person.firstName} {person.lastName}</div>
                                            <div className="text-sm text-gray-500">{person.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">{person.phoneNumber}</td>
                                <td className="px-6 py-4">
                                    {isAdmin ? (
                                        <span className="text-sm text-gray-500">{person.createdAt ? new Date(person.createdAt.seconds * 1000).toLocaleDateString('th-TH') : '-'}</span>
                                    ) : (
                                        <select value={person.status} onChange={(e) => handleStatusChange(person.id, e.target.value)} className="text-sm border rounded px-2 py-1 bg-white text-gray-900">
                                            <option value="available">พร้อมทำงาน</option><option value="on_leave">ลาพัก</option><option value="suspended">พักงาน</option>
                                        </select>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right text-sm">
                                    <button onClick={() => { setSelected(person); setModalMode('edit'); }} className={`${textColor} hover:underline mr-3`}>แก้ไข</button>
                                    <button onClick={() => setToDelete(person)} className="text-red-600 hover:underline">ลบ</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">ยังไม่มี{isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</p>
                        <button onClick={() => setModalMode('add')} className={`mt-3 ${textColor} hover:underline text-sm`}>+ เพิ่ม{isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'}คนแรก</button>
                    </div>
                )}
            </div>
        </div>
    );
}
