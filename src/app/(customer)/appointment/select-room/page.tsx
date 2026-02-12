"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useProfile } from '@/context/ProfileProvider';
import { RoomType } from '@/types';
import LoadingScreen from '@/app/components/common/LoadingScreen';

const Icons = {
    Check: () => <svg className="w-4 h-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
};

function RoomDetailContent() {
    // ... hooks ...
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const incomingCheckIn = searchParams.get('checkIn');
    const incomingCheckOut = searchParams.get('checkOut');
    const incomingGuests = searchParams.get('guests');
    const [roomType, setRoomType] = useState<RoomType | null>(null);
    const [reviewSummary, setReviewSummary] = useState({ average: 0, total: 0 });
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

                    const reviewSnap = await getDocs(
                        query(collection(db, 'reviews'), where('roomTypeId', '==', id)),
                    );
                    const ratings = reviewSnap.docs
                        .map((reviewDoc) => Number((reviewDoc.data() as any).rating || 0))
                        .filter((score) => Number.isFinite(score) && score > 0);
                    const total = ratings.length;
                    const average = total > 0 ? Number((ratings.reduce((sum, score) => sum + score, 0) / total).toFixed(1)) : 0;
                    setReviewSummary({ average, total });
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

        router.push(`/appointment/guest-info?${params.toString()}`);
    };

    if (loading || profileLoading) {
        return (
            <LoadingScreen spinnerStyle={{ animationDuration: '3s' }} />
        );
    }
    if (!roomType) return null;

    const images = roomType.imageUrls && roomType.imageUrls.filter(url => url).length > 0
        ? roomType.imageUrls.filter(url => url)
        : [];

    const mainImage = images.length > 0 ? images[selectedImageIndex] : null;

    return (
        <div className="min-h-screen bg-[var(--background)] pb-24 text-[var(--text)]">
            <div className="px-5 pt-4">
                {/* 1. Main Image Area */}
                <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden bg-gray-200 mb-6">
                    {mainImage ? (
                        <img
                            src={mainImage}
                            alt={roomType.name}
                            className="object-cover w-full h-full"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-[var(--text-muted)]">No Image</div>
                    )}

                    {/* Floating Info Card */}
                    <div className="absolute top-[20%] left-0 right-0 bottom-4 px-4 flex items-end pointer-events-none">
                        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 w-full  border border-white/50 pointer-events-auto flex justify-between items-center">
                            <div className="space-y-1">
                                <p className="text-xs text-gray-500 font-medium">ผู้เข้าพักสูงสุด</p>
                                <p className="text-xs text-gray-500 font-medium">ขนาดห้อง</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-sm font-bold text-gray-800">{roomType.maxGuests || 2} ท่าน</p>
                                <p className="text-sm font-bold text-gray-800">{roomType.sizeSqM || '-'} ตร.ม.</p>
                            </div>
                            <div className="h-8 w-[1px] bg-gray-300 mx-2"></div>
                            <div className="space-y-1 text-right">
                                <p className="text-xs text-gray-500 font-medium">ราคาเริ่มต้น / คืน</p>
                                <p className="text-lg font-extrabold text-[#232227]">{roomType.basePrice?.toLocaleString()} {profile.currencySymbol || '฿'}</p>
                                <p className="text-xs font-semibold text-amber-500">
                                    {reviewSummary.total > 0
                                        ? `Rating ${reviewSummary.average} (${reviewSummary.total} reviews)`
                                        : 'No reviews yet'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Gallery */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Gallery</h3>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {images.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedImageIndex(idx)}
                                className={`relative w-18 h-18 flex-shrink-0 rounded-2xl overflow-hidden transition-all ${selectedImageIndex === idx ? 'ring ring-[var(--primary)]' : 'opacity-100'}`}
                            >
                                <img src={img} alt="" className="object-cover w-full h-full" />
                            </button>
                        ))}
                        {images.length === 0 && <div className="text-xs text-[var(--text-muted)]">ไม่มีรูปภาพเพิ่มเติม</div>}
                    </div>
                </div>

                {/* 3. Descriptions */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-[var(--text)] mb-2">Descriptions</h3>
                    <div className="text-[var(--text-muted)] text-sm leading-relaxed whitespace-pre-line">
                        {roomType.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                    </div>
                </div>

                {/* 4. Amenities (Optional) */}
                {roomType.amenities && roomType.amenities.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Amenities</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {roomType.amenities.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-[var(--text-muted)] bg-white px-3 py-2 rounded-xl border border-gray-100">
                                    <Icons.Check />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Bar (Fixed) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border)] px-5 py-4 z-50  ">
                <div className="max-w-md mx-auto">
                   
                    <button
                        onClick={handleConfirm}
                        className="w-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white py-3 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 transition-all transform active:scale-95 shadow-[var(--primary)]/20"
                    >
                        จองห้องนี้
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
                <LoadingScreen
                    color="#553734"
                    backgroundClassName=""
                    spinnerStyle={{ animationDuration: '3s' }}
                />
            }
        >
            <RoomDetailContent />
        </Suspense>
    );
}

