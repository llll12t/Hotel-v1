"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useProfile } from '@/context/ProfileProvider';
import { RoomType } from '@/types';
import LoadingScreen from '@/app/components/common/LoadingScreen';

// --- Icons ---
const StarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-500">
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
);

const BathtubIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
);

const WifiIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-black">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
    </svg>
);

const ParkingPIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-black">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12h4c1.1 0 2-.9 2-2s-.9-2-2-2H9v7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const getAmenityIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('wifi') || lowerName.includes('internet')) return <WifiIcon />;
    if (lowerName.includes('parking') || lowerName.includes('car')) return <ParkingPIcon />;
    if (lowerName.includes('bath') || lowerName.includes('shower') || lowerName.includes('toilet')) return <BathtubIcon />;
    // Default generic icon (Star) if no match
    return <StarIcon />;
};


function RoomDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get all params to pass through
    const id = searchParams?.get('id');
    const incomingCheckIn = searchParams?.get('checkIn');
    const incomingCheckOut = searchParams?.get('checkOut');
    const incomingGuests = searchParams?.get('guests');
    const incomingNights = searchParams?.get('nights');
    const incomingRooms = searchParams?.get('rooms');

    const [roomType, setRoomType] = useState<RoomType | null>(null);
    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    const [reviewsData, setReviewsData] = useState({ rating: 0, count: 0 });

    useEffect(() => {
        if (!id) {
            router.push('/appointment');
            return;
        }
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Room
                const docRef = doc(db, 'roomTypes', id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setRoomType({ id: docSnap.id, ...docSnap.data() } as RoomType);

                    // Fetch Reviews (Parallel-ish or sequential is fine)
                    // Assuming reviews are stored in a top-level 'reviews' collection with roomTypeId
                    try {
                        const reviewsQ = query(collection(db, 'reviews'), where('roomTypeId', '==', id));
                        const reviewsSnap = await getDocs(reviewsQ);

                        if (!reviewsSnap.empty) {
                            const scores = reviewsSnap.docs.map(d => d.data().score || d.data().rating || 0).filter(s => s > 0);
                            const count = scores.length;
                            const avg = count > 0 ? (scores.reduce((a, b) => a + b, 0) / count) : 0;
                            setReviewsData({ rating: avg, count });
                        }
                    } catch (reviewErr) {
                        console.warn("Could not fetch reviews:", reviewErr);
                    }

                } else {
                    router.push('/appointment');
                }
            } catch (error) {
                console.error("Error fetching room type:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, router]);

    const handleConfirm = () => {
        if (!roomType) return;
        const params = new URLSearchParams();
        params.set('roomTypeId', roomType.id || '');
        if (incomingCheckIn) params.set('checkIn', incomingCheckIn);
        if (incomingCheckOut) params.set('checkOut', incomingCheckOut);
        if (incomingGuests) params.set('guests', incomingGuests);
        if (incomingNights) params.set('nights', incomingNights);
        if (incomingRooms) params.set('rooms', incomingRooms);

        router.push(`/appointment/guest-info?${params.toString()}`);
    };

    if (loading || profileLoading) {
        return <LoadingScreen spinnerStyle={{ animationDuration: '3s' }} />;
    }
    if (!roomType) return null;

    const images = roomType.imageUrls && roomType.imageUrls.filter(url => url).length > 0
        ? roomType.imageUrls.filter(url => url)
        : [];
    const mainImage = images.length > 0 ? images[selectedImageIndex] : null;

    // Use description from DB, split by newlines for paragraphs
    const details = roomType.description
        ? roomType.description.split('\n').filter(line => line.trim() !== '')
        : ["No description available."];

    // Dummy Amenities if not in DB (assuming DB structure might not have it yet, but using data where possible)
    // If roomType has amenities array, use it. Else default.
    const amenitiesList = (roomType as any).amenities || ["Bathroom", "Wifi", "Parking"];

    return (
        <div className="min-h-screen bg-[#F6F6F6] font-sans pb-32">

            <div className="p-4">
                {/* Image & Gallery */}
                <div className="mb-6">
                    <div className="relative aspect-[16/10] w-full bg-gray-200 rounded-xl overflow-hidden border border-gray-100 mb-3">
                        {mainImage ? (
                            <img
                                src={mainImage}
                                alt={roomType.name}
                                className="w-full h-full object-cover transition-all duration-300"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                        )}
                    </div>

                    {/* Gallery Thumbnails */}
                    {images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                            {images.map((img, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedImageIndex(idx)}
                                    className={`relative w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedImageIndex === idx ? 'border-black opacity-100' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                >
                                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Title & Price */}
                <div className="mb-6">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{roomType.name}</h1>
                            {roomType.sizeSqM && (
                                <p className="text-sm text-gray-500 font-medium mt-1">{roomType.sizeSqM} ตารางเมตร</p>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-bold text-gray-900">{Math.floor(roomType.basePrice || 0).toLocaleString()}</span>
                            <span className="text-sm font-normal text-gray-900 ml-1">บาท/คืน</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-start">
                        {/* Use Capacity if available, else generic Vip */}
                        <span className="text-sm text-gray-400 font-medium">
                            {(roomType as any).capacity ? `Max ${(roomType as any).capacity} Guests` : 'Vip'}
                        </span>

                        {/* Rating */}
                        <div className="flex items-center gap-1.5">
                            <StarIcon />
                            <span className="text-sm font-bold text-gray-900">{reviewsData.rating > 0 ? reviewsData.rating.toFixed(1) : 'New'}</span>
                            <span className="text-[10px] text-gray-400 font-normal">
                                {reviewsData.count > 0 ? `${reviewsData.count} reviews` : '(No reviews)'}
                            </span>
                        </div>
                    </div>
                </div>

                <hr className="border-gray-200 mb-6" />

                {/* Amenities */}
                <div className="mb-6">
                    <h2 className="text-base font-normal text-gray-900 mb-4">Amenities</h2>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth">
                        {(roomType.amenities && roomType.amenities.length > 0) ? (
                            roomType.amenities.map((amenity, index) => (
                                <div key={index} className="flex items-center gap-3 border border-gray-200 bg-white rounded-xl py-3 px-4 min-w-max">
                                    {getAmenityIcon(amenity)}
                                    <span className="text-sm font-medium text-gray-900 capitalize">{amenity}</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center gap-3 border border-gray-200 bg-white rounded-xl py-3 px-4 min-w-max">
                                <span className="text-sm font-medium text-gray-400">No specific amenities listed</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="mb-24">
                    <h2 className="text-base font-normal text-gray-900 mb-4">Details</h2>
                    <div className="space-y-1">
                        {details.map((detail, idx) => (
                            <p key={idx} className="text-sm text-gray-900 font-normal leading-relaxed">{detail}</p>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-50 rounded-t-[24px] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="max-w-md mx-auto">
                    <button
                        onClick={handleConfirm}
                        className="w-full bg-black text-white py-4 rounded-xl font-medium text-base shadow-lg hover:opacity-90 transition-all active:scale-[0.98]"
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
