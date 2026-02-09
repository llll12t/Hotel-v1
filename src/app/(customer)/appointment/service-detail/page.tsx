"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';
import { RoomType } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

// --- Icons ---
const Icons = {
    User: () => <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Maximize: () => <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
    Check: () => <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
    Back: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
};

function RoomDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const incomingCheckIn = searchParams.get('checkIn');
    const incomingCheckOut = searchParams.get('checkOut');
    const incomingGuests = searchParams.get('guests');
    const [roomType, setRoomType] = useState<RoomType | null>(null);
    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    useEffect(() => {
        if (!id) {
            router.push('/appointment'); // Redirect back if no ID
            return;
        }
        const fetchRoom = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'roomTypes', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setRoomType({ id: docSnap.id, ...docSnap.data() } as RoomType);
                } else {
                    console.error("Room Type not found");
                    router.push('/appointment');
                }
            } catch (error) {
                console.error("Error fetching room type:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRoom();
    }, [id, router]);

    const handleConfirm = () => {
        if (!roomType) return;
        // Forward any incoming search params (checkIn/checkOut/guests)
        const params = new URLSearchParams();
        params.set('roomTypeId', roomType.id || '');
        if (incomingCheckIn) params.set('checkIn', incomingCheckIn);
        if (incomingCheckOut) params.set('checkOut', incomingCheckOut);
        if (incomingGuests) params.set('guests', incomingGuests);

        router.push(`/appointment/select-date-time?${params.toString()}`);
    };

    if (loading || profileLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
            </div>
        );
    }
    if (!roomType) return null;

    const images = roomType.imageUrls && roomType.imageUrls.filter(url => url).length > 0
        ? roomType.imageUrls.filter(url => url)
        : [];

    const mainImage = images.length > 0 ? images[selectedImageIndex] : null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <CustomerHeader showBackButton={true} showActionButtons={false} />

            <div className="flex-1 pb-24">
                {/* 1. Image Gallery */}
                <div className="bg-white rounded-b-3xl shadow-sm overflow-hidden mb-4">
                    <div className="relative w-full aspect-video sm:h-96 bg-gray-200">
                        {mainImage ? (
                            <img
                                src={mainImage}
                                alt={roomType.name}
                                className="object-cover w-full h-full"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-4 left-4 right-4 text-white">
                            <h1 className="text-2xl sm:text-3xl font-bold shadow-sm">{roomType.name}</h1>
                        </div>
                    </div>

                    {/* Thumbnail List */}
                    {images.length > 1 && (
                        <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedImageIndex(idx)}
                                    className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${selectedImageIndex === idx ? 'border-[#5D4037] ring-1 ring-[#5D4037]' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                >
                                    <img src={img} alt="" className="object-cover w-full h-full" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-4 max-w-3xl mx-auto space-y-4">

                    {/* 2. Basic Info & Price */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">ข้อมูลห้องพัก</h2>
                                <p className="text-gray-500 text-sm">{roomType.name}</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-extrabold text-[#5D4037]">
                                    {profile.currencySymbol || '฿'}{(roomType.basePrice || 0).toLocaleString()}
                                </span>
                                <span className="text-xs text-gray-400">ราคาเริ่มต้น / คืน</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="p-2 bg-white rounded-full shadow-sm"><Icons.User /></div>
                                <div>
                                    <p className="text-xs text-gray-500">ผู้เข้าพักสูงสุด</p>
                                    <p className="font-semibold text-gray-800">{roomType.maxGuests || 2} ท่าน</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="p-2 bg-white rounded-full shadow-sm"><Icons.Maximize /></div>
                                <div>
                                    <p className="text-xs text-gray-500">ขนาดห้อง</p>
                                    <p className="font-semibold text-gray-800">{roomType.sizeSqM || '-'} ตร.ม.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Amenities */}
                    {roomType.amenities && roomType.amenities.length > 0 && (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">สิ่งอำนวยความสะดวก</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {roomType.amenities.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                        <Icons.Check />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 4. Description */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-3">รายละเอียดเพิ่มเติม</h2>
                        <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                            {roomType.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                        </div>
                    </div>

                </div>
            </div>

            {/* Bottom Bar (Fixed) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 shadow-lg">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <div className="hidden sm:block">
                        <p className="text-xs text-gray-500">ราคาเริ่มต้น</p>
                        <p className="text-xl font-bold text-[#5D4037]">{profile.currencySymbol || '฿'}{(roomType.basePrice || 0).toLocaleString()} <span className="text-sm font-medium text-gray-400">/ คืน</span></p>
                    </div>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 sm:flex-none sm:w-64 py-3.5 bg-[#5D4037] hover:bg-[#3E2723] text-white rounded-xl font-bold text-base transition-all transform active:scale-95 shadow-lg shadow-[#5D4037]/20"
                    >
                        เลือกห้องพักนี้
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ServiceDetailPage() {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
                </div>
            }
        >
            <RoomDetailContent />
        </Suspense>
    );
}
