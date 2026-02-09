"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { RoomType } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';
import { format, addDays } from 'date-fns';

// --- Icons ---
const Icons = {
    Calendar: () => <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    User: () => <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Search: () => <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Users: () => <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Maximize: () => <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
};

export default function AppointmentPage() {
    const router = useRouter();
    const { profile } = useProfile();

    // Search State
    const [checkIn, setCheckIn] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [checkOut, setCheckOut] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [guests, setGuests] = useState(2);

    // Data State
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchRoomTypes = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const roomTypesRef = collection(db, 'roomTypes');
            const q = query(roomTypesRef, where('status', '==', 'available'));
            const snapshot = await getDocs(q);

            const fetchedRoomTypes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RoomType[];

            // Client-side sort
            fetchedRoomTypes.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));

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
        // Just refresh for now
        fetchRoomTypes();
    };

    const handleSelectRoomType = (roomType: RoomType) => {
        // Pass search params to detail page
        const params = new URLSearchParams();
        params.set('id', roomType.id || '');
        params.set('checkIn', checkIn);
        params.set('checkOut', checkOut);
        params.set('guests', guests.toString());
        router.push(`/appointment/service-detail?${params.toString()}`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <CustomerHeader showBackButton={true} showActionButtons={false} />

            {/* 1. Search Section (Sticky) */}
            <div className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-100 px-4 py-3">
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <div className="flex-1 relative group">
                            <label className="absolute -top-1 left-2 bg-white px-1 text-[10px] text-gray-400 group-focus-within:text-[#5D4037]">เช็คอิน</label>
                            <input
                                type="date"
                                value={checkIn}
                                onChange={(e) => setCheckIn(e.target.value)}
                                className="w-full pl-3 pr-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-[#5D4037] transition-colors"
                            />
                        </div>
                        <div className="flex-1 relative group">
                            <label className="absolute -top-1 left-2 bg-white px-1 text-[10px] text-gray-400 group-focus-within:text-[#5D4037]">เช็คเอาท์</label>
                            <input
                                type="date"
                                value={checkOut}
                                min={checkIn}
                                onChange={(e) => setCheckOut(e.target.value)}
                                className="w-full pl-3 pr-2 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-[#5D4037] transition-colors"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1 group">
                            <label className="absolute -top-1 left-2 bg-white px-1 text-[10px] text-gray-400 group-focus-within:text-[#5D4037]">ผู้เข้าพัก</label>
                            <select
                                value={guests}
                                onChange={(e) => setGuests(Number(e.target.value))}
                                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-[#5D4037] appearance-none"
                            >
                                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} ท่าน</option>)}
                            </select>
                            <div className="absolute right-3 top-2.5 pointer-events-none text-gray-400"><Icons.User /></div>
                        </div>
                        <button
                            onClick={handleSearch}
                            className="bg-[#5D4037] text-white px-5 py-2 rounded-lg font-medium text-sm shadow-sm hover:bg-[#4E342E] active:scale-95 transition-all flex items-center justify-center gap-2 min-w-[100px]"
                        >
                            <Icons.Search /> ค้นหา
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Room List */}
            <div className="p-4 space-y-4 max-w-lg mx-auto md:max-w-2xl">
                {errorMsg ? (
                    <div className="text-center py-10 text-red-500">{errorMsg}</div>
                ) : roomTypes.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm p-8">
                        <p>ไม่พบห้องพักว่างในช่วงเวลานี้</p>
                        <button onClick={fetchRoomTypes} className="mt-4 text-[#5D4037] underline">ลองใหม่อีกครั้ง</button>
                    </div>
                ) : (
                    roomTypes.map((room) => (
                        <div
                            key={room.id}
                            onClick={() => handleSelectRoomType(room)}
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow cursor-pointer group"
                        >
                            {/* Image Area */}
                            <div className="relative h-56 w-full bg-gray-200 overflow-hidden">
                                {room.imageUrls && room.imageUrls.length > 0 ? (
                                    <img
                                        src={room.imageUrls[0]}
                                        alt={room.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                                )}
                                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full text-gray-700 shadow-sm">
                                    {room.status === 'available' ? 'ว่าง' : 'ไม่ว่าง'}
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-gray-900 leading-tight">{room.name}</h3>
                                    <div className="text-right">
                                        <div className="font-bold text-xl text-[#5D4037]">
                                            {profile?.currencySymbol || '฿'}{(room.basePrice || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-gray-400">ราคาต่อคืน</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                        <Icons.Users />
                                        <span>{room.maxGuests} ท่าน</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                        <Icons.Maximize />
                                        <span>{room.sizeSqM || '-'} ตร.ม.</span>
                                    </div>
                                </div>

                                <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">
                                    {room.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                                </p>

                                <button onClick={(e) => { e.stopPropagation(); handleSelectRoomType(room); }} className="w-full py-3 rounded-xl bg-[#5D4037] text-white font-semibold text-sm hover:bg-[#4E342E] transition-colors shadow-sm">
                                    ดูรายละเอียด & จอง
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Safe Area for Mobile */}
            <div className="h-10"></div>
        </div>
    );
}
