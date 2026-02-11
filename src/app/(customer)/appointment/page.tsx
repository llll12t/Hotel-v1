"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, doc, onSnapshot } from 'firebase/firestore';
import { RoomType } from '@/types';
import LoadingScreen from '@/app/components/common/LoadingScreen';
import { format, addDays } from 'date-fns';

// --- Icons ---
const CalendarIcon = () => (
    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const SearchIcon = () => (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const BedIcon = () => (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M2 13h2V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6h2v2h-2v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5H2v-2zm2-4v4h16V9H4z" />
    </svg>
);

const UserIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

    // Data State
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [soldOutRoomTypeIds, setSoldOutRoomTypeIds] = useState<Set<string>>(new Set());

    const checkInRef = useRef<HTMLInputElement>(null);
    const checkOutRef = useRef<HTMLInputElement>(null);

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

    if (loading) {
        return (
            <LoadingScreen spinnerStyle={{ animationDuration: '3s' }} />
        );
    }

    return (
        <div className="min-h-screen bg-[#f2f2f2] pb-20 text-[var(--text)] px-5 pt-6">

            {/* 1. Header Card */}
            <div className="rounded-md relative overflow-hidden shadow-lg mb-6 bg-[#2a2a2e]">
                <div className="px-5 flex justify-between items-stretch min-h-[76px]">
                    <div className="flex items-center gap-3 z-10 py-3">
                        {liffProfile?.pictureUrl ? (
                            <div className="w-11 h-11 rounded-xl bg-gray-200 overflow-hidden ring-2 ring-[#3b82f6] flex-shrink-0">
                                <img src={liffProfile.pictureUrl} alt="Profile" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-11 h-11 rounded-xl bg-gray-300 ring-2 ring-[#3b82f6] flex-shrink-0"></div>
                        )}
                        <div className="leading-tight">
                            <p className="text-gray-300 text-[12px] font-medium">Good morning</p>
                            <p className="text-white text-sm font-semibold truncate max-w-[150px]">{liffProfile?.displayName || 'Guest'}</p>
                        </div>
                    </div>

                    {/* Points Badge */}
                    <div
                        className="bg-[#ff7a3d] text-white pl-7 pr-5 -mr-5 flex flex-col items-end justify-center min-w-[110px] rounded-l-[0px]"
                        style={{ clipPath: 'polygon(22% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
                    >
                        <span className="text-[10px] opacity-90 font-medium">Points</span>
                        <span className="text-base font-bold leading-tight">{customerData?.points?.toLocaleString() || 0}</span>
                    </div>
                </div>
            </div>


            {/* 2. Search Section */}
            <div className="space-y-3 mb-8">
                <div className="grid grid-cols-2 gap-3">
                    {/* Date Input - Check-in */}
                    <div
                        onClick={() => checkInRef.current?.showPicker()}
                        className="bg-white rounded-md px-4 py-2.5 border border-gray-100 h-16 flex items-center gap-2 shadow-sm cursor-pointer hover:border-[#ff7a3d]/50 transition-colors"
                    >
                        <div className="flex-1 min-w-0 pointer-events-none">
                            <label className="text-[10px] text-gray-400 font-medium block leading-tight">Date</label>
                            <input
                                ref={checkInRef}
                                type="date"
                                value={checkIn}
                                onChange={(e) => setCheckIn(e.target.value)}
                                className="date-input bg-transparent text-sm w-full outline-none font-bold text-gray-900 appearance-none pointer-events-auto"
                            />
                        </div>
                        <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-500">
                            <CalendarIcon />
                        </div>
                    </div>
                    {/* Date Input - Check-out */}
                    <div
                        onClick={() => checkOutRef.current?.showPicker()}
                        className="bg-white rounded-md px-4 py-2.5 border border-gray-100 h-16 flex items-center gap-2 shadow-sm cursor-pointer hover:border-[#ff7a3d]/50 transition-colors"
                    >
                        <div className="flex-1 min-w-0 pointer-events-none">
                            <label className="text-[10px] text-gray-400 font-medium block leading-tight">Date</label>
                            <input
                                ref={checkOutRef}
                                type="date"
                                value={checkOut}
                                min={checkIn}
                                onChange={(e) => setCheckOut(e.target.value)}
                                className="date-input bg-transparent text-sm w-full outline-none font-bold text-gray-900 appearance-none pointer-events-auto"
                            />
                        </div>
                        <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-500">
                            <CalendarIcon />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 h-14">
                    <div className="bg-white rounded-md px-4 py-2.5 border border-gray-100 flex-1 flex flex-col justify-center shadow-sm h-14">
                        <select
                            value={guests}
                            onChange={(e) => setGuests(Number(e.target.value))}
                            className="bg-transparent text-sm w-full outline-none font-semibold text-gray-800"
                        >
                            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} Person{n > 1 ? 's' : ''}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={handleSearch}
                        className="bg-[#ff7a3d] hover:bg-[#ff6a24] text-white font-semibold rounded-md px-7 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm h-14"
                    >
                        <span>ค้นหา</span>
                        <SearchIcon />
                    </button>
                </div>
            </div>


            {/* 3. Room List (Grid) */}
            <div className="grid grid-cols-2 gap-4">
                {errorMsg ? (
                    <div className="col-span-2 text-center py-10 text-[var(--error)]">{errorMsg}</div>
                ) : roomTypes.length === 0 ? (
                    <div className="col-span-2 text-center py-10 text-[var(--text-muted)] bg-[var(--card)] rounded-xl  p-8">
                        <p>ไม่พบห้องพักว่างในช่วงเวลานี้</p>
                        <button onClick={fetchRoomTypes} className="mt-4 text-[var(--primary)] underline">ลองใหม่อีกครั้ง</button>
                    </div>
                ) : (
                    roomTypes.map((room) => {
                        const isSoldOut = soldOutRoomTypeIds.has(room.id!);
                        return (
                            <div
                                key={room.id}
                                onClick={() => !isSoldOut && handleSelectRoomType(room)}
                                className={`bg-white rounded-md overflow-hidden transition-all border border-gray-100 p-2 group relative
                                    ${isSoldOut ? 'opacity-70 cursor-not-allowed grayscale' : 'hover:shadow-md active:scale-[0.98] cursor-pointer'}`}
                            >
                                {isSoldOut && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/10">
                                        <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg transform -rotate-12">จองเต็ม</span>
                                    </div>
                                )}
                                {/* Image */}
                                <div className="relative aspect-[4/3] bg-gray-200 overflow-hidden rounded-xl">
                                    {room.imageUrls && room.imageUrls.length > 0 ? (
                                        <img
                                            src={room.imageUrls[0]}
                                            alt={room.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-[var(--text-muted)] bg-gray-100 text-xs">No Image</div>
                                    )}
                                </div>

                                {/* Info Section */}
                                <div className={`mt-2 ${isSoldOut ? 'bg-gray-600' : 'bg-[#1f1f22]'} text-white rounded-xl px-3 py-2`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-semibold text-xs truncate flex-1 mr-2">{room.name}</h3>
                                        <span className="text-[#ff7a3d] font-bold text-xs flex-shrink-0">
                                            {Math.floor(room.basePrice || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-white/80">
                                        <span className="flex items-center gap-1">
                                            <span className="text-white/80"><BedIcon /></span> 1
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="text-white/80"><UserIcon /></span> {room.maxGuests || 2}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Safe Area */}
            <div className="h-6"></div>

            <style jsx>{`
                .date-input::-webkit-calendar-picker-indicator {
                    opacity: 0;
                    width: 32px;
                    height: 32px;
                    cursor: pointer;
                }
                .date-input::-webkit-inner-spin-button,
                .date-input::-webkit-clear-button {
                    display: none;
                }
                .date-input {
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                }
            `}</style>
        </div>
    );
}
