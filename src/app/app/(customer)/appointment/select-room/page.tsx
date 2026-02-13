"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useProfile } from '@/context/ProfileProvider';
import { RoomType } from '@/types';
import LoadingScreen from '@/app/components/common/LoadingScreen';
import CustomerHeader from '@/app/components/CustomerHeader';

function RoomDetailContent() {
    // ... hooks ...
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams?.get('id');
    const incomingCheckIn = searchParams?.get('checkIn');
    const incomingCheckOut = searchParams?.get('checkOut');
    const incomingGuests = searchParams?.get('guests');
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

    // --- Mock Amenities for Display if empty ---
    const displayAmenities = roomType.amenities && roomType.amenities.length > 0
        ? roomType.amenities
        : ['Wifi', 'AC', 'TV', 'Shower'];

    return (
        <div className="min-h-screen bg-white pb-24 text-[#232227]">
            <CustomerHeader showBackButton={true} />

            <div className="px-5">
                {/* 1. Main Image Area */}
                <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden bg-gray-100 mb-6 shadow-sm">
                    {mainImage ? (
                        <img
                            src={mainImage}
                            alt={roomType.name}
                            className="object-cover w-full h-full"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                    )}
                </div>

                {/* 2. Title & Price */}
                <div className="flex justify-between items-start mb-1">
                    <h1 className="text-2xl font-bold text-[#232227] tracking-tight flex-1 mr-4">{roomType.name}</h1>
                    <div className="text-right flex-shrink-0">
                        <span className="text-xl font-bold text-[#232227]">{roomType.basePrice?.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 font-medium uppercase"> /Night</span>
                    </div>
                </div>

                {/* 3. Location & Rating */}
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Thailand, Bangkok</span> {/* Placeholder Location */}
                    </div>
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
                        <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-bold text-[#232227]">{reviewSummary.average || 'New'}</span>
                        <span className="text-xs text-gray-400">({reviewSummary.total} Reviews)</span>
                    </div>
                </div>

                {/* 4. Amenities */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-base font-bold text-[#232227]">Amenities</h2>
                        <button className="text-xs text-gray-400 font-medium hover:text-gray-600">View All</button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5">
                        {displayAmenities.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2 min-w-[64px]">
                                <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 border border-gray-100">
                                    {/* Generic Icon - ideally toggle based on name */}
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium truncate w-full text-center">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Descriptions */}
                <div className="mb-24">
                    <h2 className="text-base font-bold text-[#232227] mb-3">Descriptions</h2>
                    <p className="text-sm text-gray-400 leading-7 font-normal">
                        {roomType.description || 'Welcome to our luxurious room. Experience comfort and style in the heart of the city. Perfect for relaxation and getting away from the hustle and bustle.'}
                    </p>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 z-50">
                <div className="max-w-md mx-auto flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-gray-400">Total Price</p>
                        <p className="text-xl font-bold text-[#232227]">{roomType.basePrice?.toLocaleString()} <span className="text-sm font-normal text-gray-400">/ night</span></p>
                    </div>
                    <button
                        onClick={handleConfirm}
                        className="bg-[#232227] hover:bg-black text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-lg transform active:scale-95 transition-all"
                    >
                        Book Now
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
