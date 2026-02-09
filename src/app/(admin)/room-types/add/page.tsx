"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import ImageUploadBase64 from '@/app/components/ImageUploadBase64';

const Icons = {
    Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

export default function AddRoomTypePage() {
    const [formData, setFormData] = useState({
        name: '',
        basePrice: '',
        maxGuests: '',
        sizeSqM: '',
        description: '',
        amenities: [] as string[],
        imageUrls: [''] as string[], // Initialize with one empty slot
    });

    const [amenityInput, setAmenityInput] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    // Handlers
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleImageChange = (index: number, url: string) => {
        setFormData(prev => {
            const newImages = [...prev.imageUrls];
            if (url) {
                // Update or Add
                if (index < newImages.length) {
                    newImages[index] = url;
                } else {
                    newImages.push(url);
                }
                // If we customized the last slot and it's full, add a new empty slot if less than 5
                // Actually, let's keep it simple: Fixed 5 slots concept or dynamic list?
                // Dynamic list is better. removing empty strings.
            } else {
                // Remove
                newImages.splice(index, 1);
            }
            return { ...prev, imageUrls: newImages };
        });
    };

    // Helper to get array of 5 slots for rendering
    // Logic: Show all existing images + 1 empty slot (if count < 5)
    // When saving, we filter out empty strings.
    const renderImageSlots = () => {
        const slots = [...formData.imageUrls];
        if (slots.length < 5 && slots[slots.length - 1] !== '') {
            slots.push('');
        }

        return slots.map((url, idx) => (
            <div key={idx} className="relative">
                <span className="absolute -top-2 -left-2 z-10 bg-gray-900 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {idx + 1}
                </span>
                <ImageUploadBase64
                    imageUrl={url}
                    onImageChange={(val) => handleImageChange(idx, val)}
                    compact={idx > 0}
                />
                {idx === 0 && <p className="text-center text-xs text-gray-500 mt-1 font-medium">รูปหลัก</p>}
            </div>
        ));
    };


    const addAmenity = () => {
        if (!amenityInput.trim()) return;
        setFormData(prev => ({ ...prev, amenities: [...prev.amenities, amenityInput.trim()] }));
        setAmenityInput('');
    };

    const removeAmenity = (index: number) => {
        setFormData(prev => ({ ...prev, amenities: prev.amenities.filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return showToast("กรุณากรอกชื่อประเภทห้อง", "error");
        if (!formData.basePrice) return showToast("กรุณากรอกราคาเริ่มต้น", "error");

        const validImages = formData.imageUrls.filter(url => url && url.length > 0);

        setLoading(true);
        try {
            const dataToSave = {
                name: formData.name,
                basePrice: Number(formData.basePrice) || 0,
                maxGuests: Number(formData.maxGuests) || 2,
                sizeSqM: Number(formData.sizeSqM) || 0,
                description: formData.description || '',
                amenities: formData.amenities,
                imageUrls: validImages,
                status: 'available',
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, "roomTypes"), dataToSave);
            showToast("เพิ่มประเภทห้องใหม่สำเร็จ!", "success");
            router.push('/room-types');
        } catch (error: any) {
            showToast("เกิดข้อผิดพลาด: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-gray-500 focus:border-gray-500";

    return (
        <div className="max-w-5xl mx-auto p-4">
            <div className="flex items-center gap-3 mb-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><Icons.Back /></button>
                <h1 className="text-xl font-bold text-gray-900">เพิ่มประเภทห้องพัก</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* 1. Basic Info */}
                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <h2 className="text-base font-semibold mb-3 text-gray-800 border-b pb-2">ข้อมูลเบื้องต้น</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อประเภทห้อง *</label>
                                    <input name="name" value={formData.name} onChange={handleChange} required className={inputClass} placeholder="เช่น Standard, Deluxe, Suite" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">ราคาต่อคืน (บาท) *</label>
                                    <input type="number" name="basePrice" value={formData.basePrice} onChange={handleChange} required className={inputClass} placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">ขนาดห้อง (ตร.ม.)</label>
                                    <input type="number" name="sizeSqM" value={formData.sizeSqM} onChange={handleChange} className={inputClass} placeholder="เช่น 32" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">ผู้เข้าพักสูงสุด (ท่าน)</label>
                                    <input type="number" name="maxGuests" value={formData.maxGuests} onChange={handleChange} className={inputClass} placeholder="2" />
                                </div>
                            </div>
                        </div>

                        {/* 2. Description & Amenities */}
                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <h2 className="text-base font-semibold mb-3 text-gray-800 border-b pb-2">รายละเอียด & สิ่งอำนวยความสะดวก</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">คำอธิบายห้องพัก</label>
                                    <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className={inputClass} placeholder="บรรยายบรรยากาศห้อง, วิว, หรือจุดเด่น..."></textarea>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">สิ่งอำนวยความสะดวก</label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={amenityInput}
                                            onChange={e => setAmenityInput(e.target.value)}
                                            className="flex-1 px-3 py-1.5 border rounded-md text-sm"
                                            placeholder="เช่น WiFi, อ่างอาบน้ำ"
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                                        />
                                        <button type="button" onClick={addAmenity} className="bg-gray-900 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-800">เพิ่ม</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.amenities.map((item, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs text-gray-800 border border-gray-200">
                                                {item}
                                                <button type="button" onClick={() => removeAmenity(idx)} className="text-gray-400 hover:text-red-600"><Icons.Trash /></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Images */}
                    <div className="space-y-4">
                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h2 className="text-base font-semibold text-gray-800">รูปภาพห้องพัก</h2>
                                <span className="text-xs text-gray-500">{formData.imageUrls.filter(x => x).length}/5 รูป</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* First image takes full width if it's the only one, otherwise grid */}
                                {renderImageSlots().map((slot, idx) => (
                                    <div key={idx} className={`${idx === 0 ? 'col-span-2' : 'col-span-1'}`}>
                                        {slot}
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-3 text-center">* รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB</p>
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">ยกเลิก</button>
                    <button type="submit" disabled={loading} className="px-8 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-lg">
                        {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                    </button>
                </div>

            </form>
        </div>
    );
}
