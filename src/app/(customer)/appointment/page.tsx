"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, doc, onSnapshot } from 'firebase/firestore';
import { RoomType } from '@/types';
import LoadingScreen from '@/app/components/common/LoadingScreen';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import CustomerHeader from '@/app/components/CustomerHeader';
import SimpleDateRangePicker from '@/app/components/common/SimpleDateRangePicker'; // Import the new picker

// --- Icons ---
const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-800">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5" />
    </svg>
);

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-800">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-800">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
);

const StarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-400">
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
);

export default function AppointmentPage() {
    const router = useRouter();
    const { profile: liffProfile } = useLiffContext();

    // User Data State
    const [customerData, setCustomerData] = useState<any>(null);

    // Search State
    const [checkIn, setCheckIn] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [checkOut, setCheckOut] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [guests, setGuests] = useState(2);
    const [nights, setNights] = useState(1);
    const [showDatePicker, setShowDatePicker] = useState(false); // New state for modal visibility

    // Data State
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [soldOutRoomTypeIds, setSoldOutRoomTypeIds] = useState<Set<string>>(new Set());

    const [reviewsStats, setReviewsStats] = useState<Record<string, { rating: number, count: number }>>({});

    const checkInRef = useRef<HTMLInputElement>(null);
    const checkOutRef = useRef<HTMLInputElement>(null);

    // Calc nights
    useEffect(() => {
        const start = parseISO(checkIn);
        const end = parseISO(checkOut);
        const diff = differenceInDays(end, start);
        setNights(diff > 0 ? diff : 0);
    }, [checkIn, checkOut]);

    // Fetch Customer Data
    useEffect(() => {
        if (liffProfile?.userId) {
            const unsub = onSnapshot(doc(db, "customers", liffProfile.userId), (doc) => {
                if (doc.exists()) setCustomerData(doc.data());
            });
            return () => unsub();
        }
    }, [liffProfile]);

    const fetchRoomTypes = async () => {
        setLoading(true);
        setErrorMsg('');
        setSoldOutRoomTypeIds(new Set());
        setReviewsStats({});

        try {
            // 1. Fetch Room Types
            const roomTypesRef = collection(db, 'roomTypes');
            const qRt = query(roomTypesRef, where('status', '==', 'available'));
            const rtSnap = await getDocs(qRt);
            const fetchedRoomTypes = rtSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RoomType[];
            fetchedRoomTypes.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));

            // 2. Fetch All Rooms (to count inventory)
            const roomsSnap = await getDocs(collection(db, 'rooms'));
            const allRooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            const inventory: Record<string, number> = {};
            allRooms.forEach(r => {
                if (r.roomTypeId) {
                    inventory[r.roomTypeId] = (inventory[r.roomTypeId] || 0) + 1;
                }
            });

            // 3. Fetch Active Bookings (to count occupancy)
            // Query only relevant bookings to optimize if possible, but for now fetch active ones
            const appsQ = query(
                collection(db, 'appointments'),
                where('bookingType', '==', 'room'),
                where('status', 'in', ['pending', 'awaiting_confirmation', 'confirmed', 'in_progress'])
            );
            const appsSnap = await getDocs(appsQ);

            const userCheckIn = new Date(checkIn);
            const userCheckOut = new Date(checkOut);
            const occupied: Record<string, number> = {};

            appsSnap.docs.forEach(doc => {
                const data = doc.data();
                const b = data.bookingInfo;
                if (!b || !b.checkInDate || !b.checkOutDate) return;

                const bStart = new Date(b.checkInDate);
                const bEnd = new Date(b.checkOutDate);

                // StartA < EndB && EndA > StartB
                if (bStart < userCheckOut && bEnd > userCheckIn) {
                    let rTypeId = data.roomTypeInfo?.id; // Try finding from Appointment first

                    // If not in appointment (e.g. old data), find from roomId
                    if (!rTypeId && b.roomId) {
                        const room = allRooms.find(r => r.id === b.roomId);
                        if (room) rTypeId = room.roomTypeId;
                    }

                    if (rTypeId) {
                        occupied[rTypeId] = (occupied[rTypeId] || 0) + 1;
                    }
                }
            });

            // 4. Determine Sold Out
            const soldOut = new Set<string>();
            fetchedRoomTypes.forEach(rt => {
                const total = inventory[rt.id!] || 0;
                const used = occupied[rt.id!] || 0;
                if (used >= total && total > 0) { // If total 0, maybe assume available? No, assume sold out if valid type. But if no rooms created, it's effectively 0 avail.
                    soldOut.add(rt.id!);
                } else if (total === 0) {
                    // Warning: if no rooms are created for this type, acts as sold out
                    soldOut.add(rt.id!);
                }
            });

            setSoldOutRoomTypeIds(soldOut);
            setRoomTypes(fetchedRoomTypes);

            // 5. Fetch Reviews content for stats
            // We fetch all reviews to aggregate. For large datasets, use a stats collection instead.
            try {
                const reviewsSnap = await getDocs(collection(db, 'reviews'));
                const stats: Record<string, { totalScore: number, count: number }> = {};

                reviewsSnap.forEach(doc => {
                    const d = doc.data();
                    const rId = d.roomTypeId;
                    const sc = d.score || d.rating || 0;
                    if (rId && sc > 0) {
                        if (!stats[rId]) stats[rId] = { totalScore: 0, count: 0 };
                        stats[rId].totalScore += sc;
                        stats[rId].count += 1;
                    }
                });

                const finalStats: Record<string, { rating: number, count: number }> = {};
                Object.keys(stats).forEach(key => {
                    finalStats[key] = {
                        rating: stats[key].totalScore / stats[key].count,
                        count: stats[key].count
                    };
                });
                setReviewsStats(finalStats);

            } catch (err) {
                console.warn("Error fetching reviews stats", err);
            }

        } catch (e: any) {
            console.error('Failed fetching room types:', e);
            setErrorMsg('ไม่สามารถโหลดข้อมูลห้องพักได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoomTypes();
    }, []);

    const handleSearch = () => {
        fetchRoomTypes();
    };

    const handleSelectRoomType = (roomType: RoomType) => {
        const params = new URLSearchParams();
        params.set('id', roomType.id || '');
        params.set('checkIn', checkIn);
        params.set('checkOut', checkOut);
        params.set('guests', guests.toString());
        router.push(`/appointment/select-room?${params.toString()}`);
    };

    const handleDateRangeChange = (start: Date, end: Date) => {
        setCheckIn(format(start, 'yyyy-MM-dd'));
        setCheckOut(format(end, 'yyyy-MM-dd'));
    };

    if (loading) {
        return (
            <LoadingScreen spinnerStyle={{ animationDuration: '3s' }} />
        );
    }

    return (
        <div className="min-h-screen bg-[#F6F6F6] font-sans pb-32">
            {/* Header */}
            <CustomerHeader showBackButton={true} />

            <div className="px-4">
                {/* Search Section */}
                <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
                    <div className="flex gap-3 mb-5 ">
                        {/* Date Range Input */}
                        <div
                            className="flex-[2] border border-gray-100 rounded-2xl px-3 py-2 flex items-center gap-3 cursor-pointer hover:border-gray-300 transition-colors relative"
                            onClick={() => setShowDatePicker(true)}
                        >
                            <div className="p-2 bg-gray-50 rounded-xl text-gray-600">
                                <CalendarIcon />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0 justify-center">
                                <div className="text-xs font-bold text-gray-900 whitespace-nowrap">
                                    {format(new Date(checkIn), 'dd/MM')} - {format(new Date(checkOut), 'dd/MM yyyy')}
                                </div>
                            </div>
                        </div>

                        {/* Nights */}
                        <div className="flex-1 border border-gray-100 rounded-2xl px-1 py-1 flex flex-col items-center justify-center gap-1 min-w-[60px]">
                            <div className="text-gray-600">
                                <SunIcon />
                            </div>
                            <span className="text-sm font-bold text-gray-900">{nights}</span>
                        </div>

                        {/* Guests */}
                        <div className="flex-1 border border-gray-100 rounded-2xl px-1 py-1 flex flex-col items-center justify-center gap-1 min-w-[60px] relative">
                            <div className="text-gray-600">
                                <UserIcon />
                            </div>
                            <select
                                value={guests}
                                onChange={(e) => setGuests(Number(e.target.value))}
                                className="appearance-none bg-transparent text-sm font-bold text-gray-900 outline-none w-full text-center absolute inset-0 opacity-0 cursor-pointer z-10"
                            >
                                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span className="text-sm font-bold text-gray-900">{guests}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleSearch}
                        className="w-full bg-black text-white font-bold rounded-2xl py-4 hover:opacity-90 transition-all active:scale-[0.98] shadow-lg text-base"
                    >
                        ค้นหาที่พัก
                    </button>
                </div>


                {/* Room List (Cards) */}
                <div className="flex flex-col gap-6">
                    {errorMsg ? (
                        <div className="text-center py-10 text-[var(--error)]">{errorMsg}</div>
                    ) : roomTypes.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 bg-white rounded-xl p-8 ">
                            <p>ไม่พบห้องพักว่างในช่วงเวลานี้</p>
                            <button onClick={fetchRoomTypes} className="mt-2 text-black underline font-medium">ลองค้นหาใหม่</button>
                        </div>
                    ) : (
                        roomTypes.map((room) => {
                            const isSoldOut = soldOutRoomTypeIds.has(room.id!);
                            return (
                                <div
                                    key={room.id}
                                    onClick={() => !isSoldOut && handleSelectRoomType(room)}
                                    className={`bg-white rounded-xl p-2  hover:shadow-md transition-all active:scale-[0.99] cursor-pointer group border border-gray-100 ${isSoldOut ? 'grayscale opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    <div className="relative aspect-[16/5] w-full bg-gray-100 rounded-[24px] overflow-hidden">
                                        {room.imageUrls && room.imageUrls.length > 0 ? (
                                            <img
                                                src={room.imageUrls[0]}
                                                alt={room.name}
                                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                                        )}
                                        {isSoldOut && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                                <span className="bg-red-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg transform -rotate-6 border-2 border-white">SOLD OUT</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="px-4 py-4">
                                        <div className="flex justify-between items-end mb-2">
                                            <h3 className="text-xl font-bold text-gray-900 truncate pr-2 tracking-tight">{room.name}</h3>
                                            <div className="flex-shrink-0 text-right leading-none">
                                                <span className="text-lg font-bold text-gray-900">{Math.floor(room.basePrice || 0).toLocaleString()}</span>
                                                <span className="text-xs text-gray-500 font-medium ml-1">บาท/คืน</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm text-gray-400 font-bold">
                                                {(room as any).capacity ? `Max ${(room as any).capacity} Guests` : 'Vip'}
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                <StarIcon />
                                                <span className="text-sm font-bold text-gray-900">
                                                    {reviewsStats[room.id!]?.rating > 0 ? reviewsStats[room.id!].rating.toFixed(1) : 'New'}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium tracking-wide">
                                                    {reviewsStats[room.id!]?.count > 0 ? `${reviewsStats[room.id!].count} reviews` : '(No reviews)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Date Picker Modal */}
            {showDatePicker && (
                <SimpleDateRangePicker
                    startDate={parseISO(checkIn)}
                    endDate={parseISO(checkOut)}
                    onChange={handleDateRangeChange}
                    onClose={() => setShowDatePicker(false)}
                />
            )}

            {/* Safe Area */}
            <div className="h-6"></div>
        </div>
    );
}
