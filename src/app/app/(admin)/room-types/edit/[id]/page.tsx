"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import ImageUploadBase64 from '@/app/components/ImageUploadBase64';

const Icons = {
    Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
};

export default function EditRoomTypePage() {
    const params = useParams();
    const id = params?.id as string;

    const [formData, setFormData] = useState({
        name: '',
        basePrice: '',
        maxGuests: '',
        sizeSqM: '',
        description: '',
        amenities: [] as string[],
        imageUrls: [''] as string[],
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
                const docSnap = await getDoc(doc(db, 'roomTypes', id));
                if (docSnap.exists()) {
                    const data = docSnap.data() as any;
                    let images = data.imageUrls || [];
                    if (images.length === 0) images = [''];

                    setFormData({
                        name: data.name || '',
                        basePrice: String(data.basePrice || ''),
                        maxGuests: String(data.maxGuests || ''),
                        sizeSqM: String(data.sizeSqM || ''),
                        description: data.description || '',
                        amenities: data.amenities || [],
                        imageUrls: images,
                    });
                } else {
                    showToast('Room type not found', 'error');
                    router.push('/room-types');
                }
            } catch (e: any) {
                showToast('Error: ' + e.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, router, showToast]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleImageChange = (index: number, url: string) => {
        setFormData(prev => {
            const newImages = [...prev.imageUrls];
            if (url) {
                if (index < newImages.length) {
                    newImages[index] = url;
                } else {
                    newImages.push(url);
                }
            } else {
                newImages.splice(index, 1);
                if (newImages.length === 0) newImages.push('');
            }
            return { ...prev, imageUrls: newImages };
        });
    };

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
                {idx === 0 && <p className="text-center text-xs text-gray-500 mt-1 font-medium">Main image</p>}
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
        if (!formData.name) return showToast('Please enter room type name', 'error');
        if (!formData.basePrice) return showToast('Please enter base price', 'error');

        const validImages = formData.imageUrls.filter(url => url && url.length > 0);

        setSaving(true);
        try {
            const dataToSave = {
                name: formData.name,
                basePrice: Number(formData.basePrice) || 0,
                maxGuests: Number(formData.maxGuests) || 2,
                sizeSqM: Number(formData.sizeSqM) || 0,
                description: formData.description || '',
                amenities: formData.amenities,
                imageUrls: validImages,
                updatedAt: new Date(),
            };

            await updateDoc(doc(db, 'roomTypes', id), dataToSave);
            showToast('Room type updated', 'success');
            router.push('/room-types');
        } catch (error: any) {
            showToast('Error: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-gray-500 focus:border-gray-500';

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-5xl mx-auto p-4">
            <div className="flex items-center gap-3 mb-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><Icons.Back /></button>
                <h1 className="text-xl font-bold text-gray-900">Edit room type</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <h2 className="text-base font-semibold mb-3 text-gray-800 border-b pb-2">Basic info</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Room type name *</label>
                                    <input name="name" value={formData.name} onChange={handleChange} required className={inputClass} placeholder="Standard, Deluxe, Suite" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Base price/night *</label>
                                    <input type="number" name="basePrice" value={formData.basePrice} onChange={handleChange} required className={inputClass} placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Room size (sqm)</label>
                                    <input type="number" name="sizeSqM" value={formData.sizeSqM} onChange={handleChange} className={inputClass} placeholder="32" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Max guests</label>
                                    <input type="number" name="maxGuests" value={formData.maxGuests} onChange={handleChange} className={inputClass} placeholder="2" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <h2 className="text-base font-semibold mb-3 text-gray-800 border-b pb-2">Description & amenities</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className={inputClass} placeholder="Room details" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Amenities</label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={amenityInput}
                                            onChange={e => setAmenityInput(e.target.value)}
                                            className="flex-1 px-3 py-1.5 border rounded-md text-sm"
                                            placeholder="WiFi, bathtub"
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                                        />
                                        <button type="button" onClick={addAmenity} className="bg-gray-900 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-800">Add</button>
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

                    <div className="space-y-4">
                        <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h2 className="text-base font-semibold text-gray-800">Room images</h2>
                                <span className="text-xs text-gray-500">{formData.imageUrls.filter(x => x).length}/5</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {renderImageSlots().map((slot, idx) => (
                                    <div key={idx} className={`${idx === 0 ? 'col-span-2' : 'col-span-1'}`}>
                                        {slot}
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-3 text-center">* JPG/PNG up to 5MB</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={saving} className="px-8 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-lg">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}
