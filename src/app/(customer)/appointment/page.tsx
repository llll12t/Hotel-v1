"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { useProfile } from '@/context/ProfileProvider';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, doc, onSnapshot } from 'firebase/firestore';
import { RoomType } from '@/types';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import SimpleDateRangePicker from '@/app/components/common/SimpleDateRangePicker';
import LoadingIcon from '@/app/components/common/LoadingIcon';

// --- Icons ---
const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5" />
    </svg>
);

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
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
    const { profile: storeProfile } = useProfile();

    const [checkIn, setCheckIn] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [checkOut, setCheckOut] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [guests, setGuests] = useState(2);
    const [nights, setNights] = useState(1);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [soldOutRoomTypeIds, setSoldOutRoomTypeIds] = useState<Set<string>>(new Set());
    const [reviewsStats, setReviewsStats] = useState<Record<string, { rating: number, count: number }>>({});

    // Calc nights
    useEffect(() => {
        const start = parseISO(checkIn);
        const end = parseISO(checkOut);
        const diff = differenceInDays(end, start);
        setNights(diff > 0 ? diff : 0);
    }, [checkIn, checkOut]);

    const fetchRoomTypes = async () => {
        setLoading(true);
        setErrorMsg('');
        setSoldOutRoomTypeIds(new Set());
        setReviewsStats({});

        try {
            const roomTypesRef = collection(db, 'roomTypes');
            const qRt = query(roomTypesRef, where('status', '==', 'available'));
            const rtSnap = await getDocs(qRt);
            const fetchedRoomTypes = rtSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RoomType[];
            fetchedRoomTypes.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));

            const roomsSnap = await getDocs(collection(db, 'rooms'));
            const allRooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            const inventory: Record<string, number> = {};
            allRooms.forEach(r => {
                if (r.roomTypeId) inventory[r.roomTypeId] = (inventory[r.roomTypeId] || 0) + 1;
            });

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
                if (bStart < userCheckOut && bEnd > userCheckIn) {
                    let rTypeId = data.roomTypeInfo?.id;
                    if (!rTypeId && b.roomId) {
                        const room = allRooms.find((r: any) => r.id === b.roomId);
                        if (room) rTypeId = room.roomTypeId;
                    }
                    if (rTypeId) occupied[rTypeId] = (occupied[rTypeId] || 0) + 1;
                }
            });

            const soldOut = new Set<string>();
            fetchedRoomTypes.forEach(rt => {
                const total = inventory[rt.id!] || 0;
                const used = occupied[rt.id!] || 0;
                if (used >= total) soldOut.add(rt.id!);
            });
            setSoldOutRoomTypeIds(soldOut);
            setRoomTypes(fetchedRoomTypes);

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
                    finalStats[key] = { rating: stats[key].totalScore / stats[key].count, count: stats[key].count };
                });
                setReviewsStats(finalStats);
            } catch (err) { console.warn("Error fetching reviews stats", err); }

        } catch (e: any) {
            console.error('Failed fetching room types:', e);
            setErrorMsg('ไม่สามารถโหลดข้อมูลห้องพักได้');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRoomTypes(); }, []);

    const handleSearch = () => fetchRoomTypes();

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

    const headerBgUrl = storeProfile?.headerImage;

    return (
        <div className="min-h-screen bg-gray-100 font-sans pb-32">

            {/* ── Header with BG Image ── */}
            <div className="relative h-[160px] w-full overflow-hidden">
                {headerBgUrl ? (
                    <>
                        <div
                            className="absolute inset-0 bg-cover bg-center scale-105"
                            style={{ backgroundImage: `url(${headerBgUrl})` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/25" />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                )}

                <div className="relative z-10 h-full flex items-center justify-between px-6 pb-12">
                    <div className="text-white">
                        <p className="text-[11px] text-white/70 font-medium tracking-wide mb-0.5">Goodmorning</p>
                        <h1 className="text-xl font-bold leading-none tracking-tight">
                            {liffProfile?.displayName || 'Guest'}
                        </h1>
                    </div>
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/80 shadow-xl flex-shrink-0">
                        {liffProfile?.pictureUrl ? (
                            <img src={liffProfile.pictureUrl} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-white/20 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">U</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── White Content Sheet ── */}
            <div className="relative z-20 -mt-8 mx-3 bg-white rounded-[28px] shadow-sm min-h-[calc(100vh-130px)] pb-10">

                {/* Search Card */}
                <div className="px-4 pt-5 pb-4">
                    <div className="flex gap-2.5 mb-4">

                        {/* Date Range */}
                        <button
                            onClick={() => setShowDatePicker(true)}
                            className="flex-[2.5] flex items-center gap-2.5 border border-gray-200 rounded-2xl px-3 py-3 hover:border-gray-300 transition-colors bg-gray-50/80"
                        >
                            <div className="text-gray-600">
                                <CalendarIcon />
                            </div>
                            <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                                {format(new Date(checkIn), 'dd/MM')} -{format(new Date(checkOut), 'dd/MM yyyy')}
                            </span>
                        </button>

                        {/* Nights */}
                        <div className="flex-1 flex flex-col items-center justify-center border border-gray-200 rounded-2xl py-2 px-2 bg-gray-50/80 min-w-[52px]">
                            <div className="text-gray-500"><SunIcon /></div>
                            <span className="text-sm font-bold text-gray-900 leading-tight">{nights}</span>
                        </div>

                        {/* Guests selector */}
                        <div className="flex-1 flex flex-col items-center justify-center border border-gray-200 rounded-2xl py-2 px-2 bg-gray-50/80 min-w-[52px] relative">
                            <div className="text-gray-500"><UserIcon /></div>
                            <select
                                value={guests}
                                onChange={(e) => setGuests(Number(e.target.value))}
                                className="appearance-none bg-transparent text-sm font-bold text-gray-900 outline-none absolute inset-0 opacity-0 cursor-pointer z-10"
                            >
                                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span className="text-sm font-bold text-gray-900 leading-tight">{guests}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleSearch}
                        className="w-full bg-[#1A1A1A] text-white font-bold rounded-2xl py-3.5 hover:opacity-90 transition-all active:scale-[0.98] text-sm tracking-wide"
                    >
                        ค้นหาที่พัก
                    </button>
                </div>

                {/* Divider */}
                <div className="mx-4 border-t border-gray-100 mb-4" />

                {/* Room List */}
                <div className="px-4 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <LoadingIcon className="w-10 h-10 text-gray-300" />
                        </div>
                    ) : errorMsg ? (
                        <div className="text-center py-10 text-red-500 text-sm">{errorMsg}</div>
                    ) : roomTypes.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-gray-500 text-sm mb-3">ไม่พบห้องพักว่างในช่วงเวลานี้</p>
                            <button onClick={fetchRoomTypes} className="text-black underline font-semibold text-sm">ลองค้นหาใหม่</button>
                        </div>
                    ) : (
                        roomTypes.map((room) => {
                            const isSoldOut = soldOutRoomTypeIds.has(room.id!);
                            const stats = reviewsStats[room.id!];
                            return (
                                <div
                                    key={room.id}
                                    onClick={() => !isSoldOut && handleSelectRoomType(room)}
                                    className={`bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer group ${isSoldOut ? 'grayscale opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    {/* Room Image */}
                                    <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
                                        {room.imageUrls && room.imageUrls.length > 0 ? (
                                            <img
                                                src={room.imageUrls[0]}
                                                alt={room.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-300 bg-gray-50">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
                                                </svg>
                                            </div>
                                        )}
                                        {isSoldOut && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                                <span className="bg-red-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg -rotate-6 border-2 border-white">SOLD OUT</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="px-4 py-4">
                                        {/* Name + Price */}
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="text-xl font-bold text-gray-900 leading-tight">{room.name}</h3>
                                            <div className="text-right flex-shrink-0 ml-2">
                                                <span className="text-lg font-bold text-gray-900">{Math.floor(room.basePrice || 0).toLocaleString()}</span>
                                                <span className="text-xs text-gray-500 ml-1">บาท/คืน</span>
                                            </div>
                                        </div>

                                        {/* Category + Rating */}
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm text-gray-400 font-medium">
                                                {(room as any).category || (room as any).capacity ? `Max ${(room as any).capacity} Guests` : 'Standard'}
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                <StarIcon />
                                                <span className="text-sm font-bold text-gray-900">
                                                    {stats?.rating > 0 ? stats.rating.toFixed(1) : '4.9'}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {stats?.count > 0 ? `${stats.count} reviews` : '10 reviwe'}
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
        </div>
    );
}
