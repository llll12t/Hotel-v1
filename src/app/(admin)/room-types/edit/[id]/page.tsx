"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import ImageUploadBase64 from '@/app/components/ImageUploadBase64';

// ── Icons ─────────────────────────────────────────────────────────────────
const BackIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>;
const XIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>;

const FL = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
        {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
);

const inputCls = 'w-full border border-gray-200 bg-gray-50 rounded-md px-3.5 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-gray-900 outline-none transition-all';

const Card = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">{title}</h2>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

export default function EditRoomTypePage() {
    const params = useParams();
    const id = params?.id as string;

    const [formData, setFormData] = useState({
        name: '', basePrice: '', maxGuests: '', sizeSqM: '', description: '',
        amenities: [] as string[], imageUrls: [''] as string[],
    });
    const [amenityInput, setAmenityInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const snap = await getDoc(doc(db, 'roomTypes', id));
                if (snap.exists()) {
                    const d = snap.data() as any;
                    let imgs = d.imageUrls || [];
                    if (imgs.length === 0) imgs = [''];
                    setFormData({
                        name: d.name || '', basePrice: String(d.basePrice || ''),
                        maxGuests: String(d.maxGuests || ''), sizeSqM: String(d.sizeSqM || ''),
                        description: d.description || '', amenities: d.amenities || [], imageUrls: imgs,
                    });
                } else {
                    showToast('ไม่พบข้อมูล', 'error');
                    router.push('/room-types');
                }
            } catch (e: any) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [id, router, showToast]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleImageChange = (index: number, url: string) => {
        setFormData(prev => {
            const imgs = [...prev.imageUrls];
            if (url) { index < imgs.length ? (imgs[index] = url) : imgs.push(url); }
            else { imgs.splice(index, 1); if (imgs.length === 0) imgs.push(''); }
            return { ...prev, imageUrls: imgs };
        });
    };

    const renderImageSlots = () => {
        const slots = [...formData.imageUrls];
        if (slots.length < 5 && slots[slots.length - 1] !== '') slots.push('');
        return slots.map((url, idx) => (
            <div key={idx} className="relative">
                <span className="absolute -top-2 -left-2 z-10 bg-[#1A1A1A] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {idx + 1}
                </span>
                <ImageUploadBase64 imageUrl={url} onImageChange={val => handleImageChange(idx, val)} compact={idx > 0} />
                {idx === 0 && <p className="text-center text-[10px] text-gray-400 mt-1.5 font-medium">รูปหลัก</p>}
            </div>
        ));
    };

    const addAmenity = () => {
        if (!amenityInput.trim()) return;
        setFormData(prev => ({ ...prev, amenities: [...prev.amenities, amenityInput.trim()] }));
        setAmenityInput('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return showToast('กรุณาใส่ชื่อประเภทห้อง', 'error');
        if (!formData.basePrice) return showToast('กรุณาใส่ราคาต่อคืน', 'error');
        setSaving(true);
        try {
            await updateDoc(doc(db, 'roomTypes', id), {
                name: formData.name,
                basePrice: Number(formData.basePrice) || 0,
                maxGuests: Number(formData.maxGuests) || 2,
                sizeSqM: Number(formData.sizeSqM) || 0,
                description: formData.description || '',
                amenities: formData.amenities,
                imageUrls: formData.imageUrls.filter(u => u?.length > 0),
                updatedAt: new Date(),
            });
            showToast('บันทึกสำเร็จ', 'success');
            router.push('/room-types');
        } catch (err: any) { showToast('เกิดข้อผิดพลาด: ' + err.message, 'error'); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">กำลังโหลด...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => router.back()} className="p-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-all">
                    <BackIcon />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">แก้ไขประเภทห้องพัก</h1>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{id}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Left: Info */}
                    <div className="lg:col-span-2 space-y-5">
                        <Card title="ข้อมูลพื้นฐาน">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <FL required>ชื่อประเภทห้อง</FL>
                                    <input name="name" value={formData.name} onChange={handleChange} required className={inputCls} placeholder="Standard, Deluxe, Suite..." />
                                </div>
                                <div>
                                    <FL required>ราคาต่อคืน (฿)</FL>
                                    <input type="number" name="basePrice" value={formData.basePrice} onChange={handleChange} required className={inputCls} placeholder="0" min="0" />
                                </div>
                                <div>
                                    <FL>ผู้เข้าพักสูงสุด (ท่าน)</FL>
                                    <input type="number" name="maxGuests" value={formData.maxGuests} onChange={handleChange} className={inputCls} placeholder="2" min="1" />
                                </div>
                                <div>
                                    <FL>ขนาดห้อง (ตร.ม.)</FL>
                                    <input type="number" name="sizeSqM" value={formData.sizeSqM} onChange={handleChange} className={inputCls} placeholder="32" min="0" />
                                </div>
                            </div>
                        </Card>

                        <Card title="รายละเอียด & สิ่งอำนวยความสะดวก">
                            <div className="space-y-4">
                                <div>
                                    <FL>คำอธิบาย</FL>
                                    <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className={`${inputCls} resize-none`} placeholder="รายละเอียดของห้องพัก..." />
                                </div>
                                <div>
                                    <FL>สิ่งอำนวยความสะดวก</FL>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text" value={amenityInput}
                                            onChange={e => setAmenityInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                                            className={`${inputCls} flex-1`} placeholder="WiFi, อ่างอาบน้ำ, มินิบาร์..."
                                        />
                                        <button type="button" onClick={addAmenity}
                                            className="px-4 py-2.5 text-sm font-bold text-white rounded-md hover:opacity-90 transition-all flex-shrink-0"
                                            style={{ backgroundColor: '#1A1A1A' }}>
                                            +เพิ่ม
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.amenities.map((item, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-md text-xs font-medium text-gray-700">
                                                {item}
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, amenities: p.amenities.filter((_, i) => i !== idx) }))}
                                                    className="text-gray-400 hover:text-red-500 transition-colors">
                                                    <XIcon />
                                                </button>
                                            </span>
                                        ))}
                                        {formData.amenities.length === 0 && <p className="text-xs text-gray-400">ยังไม่มีสิ่งอำนวยความสะดวก</p>}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Right: Images */}
                    <div>
                        <Card title="รูปภาพห้องพัก" sub={`${formData.imageUrls.filter(x => x).length}/5 รูป`}>
                            <div className="grid grid-cols-2 gap-3">
                                {renderImageSlots().map((slot, idx) => (
                                    <div key={idx} className={idx === 0 ? 'col-span-2' : 'col-span-1'}>
                                        {slot}
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-3 text-center">* JPG/PNG ขนาดไม่เกิน 5MB</p>
                        </Card>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                    <button type="button" onClick={() => router.back()}
                        className="px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                        ยกเลิก
                    </button>
                    <button type="submit" disabled={saving}
                        className="px-8 py-2.5 text-sm font-bold text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                        style={{ backgroundColor: '#1A1A1A' }}>
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                กำลังบันทึก...
                            </span>
                        ) : 'บันทึกการแก้ไข'}
                    </button>
                </div>
            </form>
        </div>
    );
}
