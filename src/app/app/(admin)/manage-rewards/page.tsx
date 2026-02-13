"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import { addReward } from '@/app/actions/rewardActions';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Gift: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>,
    X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Star: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
};

// --- Add Reward Modal ---
interface AddRewardModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    currencySymbol: string;
}

function AddRewardModal({ open, onClose, onSave, currencySymbol }: AddRewardModalProps) {
    const [formData, setFormData] = useState({ name: '', description: '', pointsRequired: '', discountType: 'percentage', discountValue: '' });
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.pointsRequired || !formData.discountValue) {
            showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
            return;
        }
        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                showToast('ไม่พบการยืนยันตัวตน', 'error');
                setSaving(false);
                return;
            }
            const result = await addReward({
                name: formData.name,
                description: formData.description,
                pointsRequired: Number(formData.pointsRequired),
                discountType: formData.discountType as 'percentage' | 'fixed',
                discountValue: Number(formData.discountValue),
            }, { adminToken: token });
            if (result.success) {
                showToast('เพิ่มของรางวัลสำเร็จ!', 'success');
                setFormData({ name: '', description: '', pointsRequired: '', discountType: 'percentage', discountValue: '' });
                onSave();
                onClose();
            } else {
                showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
            }
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">เพิ่มของรางวัลใหม่</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md text-gray-500"><Icons.X /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อของรางวัล *</label>
                        <input name="name" value={formData.name} onChange={handleChange} required className={inputClass} placeholder="เช่น ส่วนลด 10%" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className={inputClass} placeholder="รายละเอียดของรางวัล..."></textarea>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">คะแนนที่ใช้แลก *</label>
                            <input type="number" name="pointsRequired" value={formData.pointsRequired} onChange={handleChange} required className={inputClass} placeholder="100" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทส่วนลด</label>
                            <select name="discountType" value={formData.discountType} onChange={handleChange} className={inputClass}>
                                <option value="percentage">เปอร์เซ็นต์ (%)</option>
                                <option value="fixed">จำนวนเงิน ({currencySymbol})</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {formData.discountType === 'percentage' ? 'เปอร์เซ็นต์ส่วนลด *' : `จำนวนเงินส่วนลด (${currencySymbol}) *`}
                        </label>
                        <input type="number" name="discountValue" value={formData.discountValue} onChange={handleChange} required className={inputClass} placeholder={formData.discountType === 'percentage' ? '10' : '50'} min="0" max={formData.discountType === 'percentage' ? '100' : undefined} />
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

export default function ManageRewardsPage() {
    const [rewards, setRewards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [rewardToDelete, setRewardToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    const fetchRewards = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'rewards'), orderBy('pointsRequired', 'asc'));
            const snap = await getDocs(q);
            setRewards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch { showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchRewards(); }, []);

    const confirmDelete = async () => {
        if (!rewardToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'rewards', rewardToDelete.id));
            setRewards(prev => prev.filter(r => r.id !== rewardToDelete.id));
            showToast('ลบของรางวัลสำเร็จ!', 'success');
        } catch (error: any) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        } finally {
            setIsDeleting(false);
            setRewardToDelete(null);
        }
    };

    if (loading || profileLoading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ConfirmationModal show={!!rewardToDelete} title="ยืนยันการลบ" message={`คุณแน่ใจหรือไม่ว่าต้องการลบของรางวัล "${rewardToDelete?.name}"?`} onConfirm={confirmDelete} onCancel={() => setRewardToDelete(null)} isProcessing={isDeleting} />
            <AddRewardModal open={showAddModal} onClose={() => setShowAddModal(false)} onSave={fetchRewards} currencySymbol={profile?.currencySymbol || '฿'} />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">จัดการของรางวัล</h1>
                    <p className="text-sm text-gray-500">ตั้งค่าของรางวัลที่ลูกค้าสามารถแลกคะแนนได้</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors">
                    <Icons.Plus /> เพิ่มของรางวัลใหม่
                </button>
            </div>

            {/* Content */}
            {rewards.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.Gift /></div>
                    <p className="text-gray-600 font-medium">ยังไม่มีของรางวัลในระบบ</p>
                    <p className="text-sm text-gray-400 mt-1">เพิ่มของรางวัลใหม่เพื่อให้ลูกค้าแลกคะแนน</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rewards.map(reward => (
                        <div key={reward.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="mb-3">
                                <h2 className="font-medium text-gray-900">{reward.name}</h2>
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{reward.description || 'ไม่มีคำอธิบาย'}</p>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    {reward.discountType === 'percentage' ? `ส่วนลด ${reward.discountValue}%` : `ส่วนลด ${reward.discountValue} ${profile.currencySymbol}`}
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    แลกแล้ว {reward.redeemedCount || 0} ครั้ง
                                </span>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t">
                                <div className="flex items-center gap-1 text-gray-900">
                                    <Icons.Star />
                                    <span className="font-semibold">{reward.pointsRequired}</span>
                                    <span className="text-sm text-gray-500">คะแนน</span>
                                </div>
                                <button onClick={() => setRewardToDelete(reward)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md border">
                                    <Icons.Trash />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
