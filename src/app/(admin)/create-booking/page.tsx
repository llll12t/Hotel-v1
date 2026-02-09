"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where, addDoc } from 'firebase/firestore';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { useToast } from '@/app/components/Toast';
import { RoomType, Room } from '@/types';

export default function CreateBookingPage() {
    const router = useRouter();
    const { showToast } = useToast();

    // Steps: 1. Select Dates -> 2. Select Room Type -> 3. Select Room (Optional) -> 4. Guest Info
    const [checkInDate, setCheckInDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [checkOutDate, setCheckOutDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));

    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);

    const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState('');

    const [guestInfo, setGuestInfo] = useState({ fullName: '', phone: '', email: '', note: '', lineUserId: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load Data
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Fetch Room Types
                const rtSnap = await getDocs(query(collection(db, 'roomTypes'), orderBy('basePrice')));
                setRoomTypes(rtSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));

                // Fetch Rooms
                const rSnap = await getDocs(query(collection(db, 'rooms'), orderBy('number')));
                setRooms(rSnap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));

            } catch (e) {
                console.error(e);
                showToast('Load failed', 'error');
            }
            setLoading(false);
        };
        load();
    }, []);

    // Filter available rooms (Mock logic for now - needs real availability check)
    const availableRooms = useMemo(() => {
        if (!selectedRoomTypeId) return [];
        return rooms.filter(r => r.roomTypeId === selectedRoomTypeId);
        // Real logic needs to check existing bookings for date range intersection
    }, [rooms, selectedRoomTypeId]);

    const selectedRoomType = roomTypes.find(rt => rt.id === selectedRoomTypeId);
    const nights = differenceInCalendarDays(new Date(checkOutDate), new Date(checkInDate)) || 1;
    const totalPrice = (selectedRoomType?.basePrice || 0) * nights;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRoomTypeId || !checkInDate || !checkOutDate || !guestInfo.fullName) {
            return showToast('Please fill all required fields', 'error');
        }

        setIsSubmitting(true);
        try {
            // Create Booking
            const bookingData = {
                roomTypeId: selectedRoomTypeId,
                roomId: selectedRoomId || null,
                checkInDate,
                checkOutDate,
                nights,
                status: 'confirmed',
                customerInfo: guestInfo,
                paymentInfo: {
                    totalPrice,
                    paymentStatus: 'pending'
                },
                createdAt: new Date(),
                createdBy: { type: 'admin', id: auth.currentUser?.uid }
            };

            await addDoc(collection(db, 'bookings'), bookingData);
            showToast('Booking created successfully', 'success');
            router.push('/dashboard');

        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

                {/* 1. Date Selection */}
                <section className="bg-white border rounded-lg p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">1. วันที่เข้าพัก (Dates)</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Check-in</label>
                            <input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} className="w-full border rounded p-2" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Check-out</label>
                            <input type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} className="w-full border rounded p-2" min={checkInDate} />
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                        ระยะเวลา: {nights} คืน
                    </div>
                </section>

                {/* 2. Room Type Selection */}
                <section className="bg-white border rounded-lg p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">2. ประเภทห้องพัก (Room Type)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {roomTypes.map(rt => (
                            <div key={rt.id} onClick={() => { setSelectedRoomTypeId(rt.id!); setSelectedRoomId(''); }}
                                className={`cursor-pointer border rounded-md p-3 flex gap-3 transition-colors ${selectedRoomTypeId === rt.id ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-gray-50'}`}>
                                <div className="w-16 h-16 bg-gray-200 rounded object-cover flex-shrink-0"></div>
                                <div>
                                    <div className={`font-medium ${selectedRoomTypeId === rt.id ? 'text-white' : 'text-gray-900'}`}>{rt.name}</div>
                                    <div className={`text-sm ${selectedRoomTypeId === rt.id ? 'text-gray-300' : 'text-gray-500'}`}>{rt.basePrice?.toLocaleString()} บาท/คืน</div>
                                    <div className={`text-xs mt-1 ${selectedRoomTypeId === rt.id ? 'text-gray-400' : 'text-gray-400'}`}>พักได้ {rt.maxGuests} ท่าน</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. Room Selection (Optional) */}
                {selectedRoomTypeId && (
                    <section className="bg-white border rounded-lg p-5">
                        <h2 className="font-semibold text-gray-900 mb-4">3. เลือกห้อง (ระบุหมายเลขห้อง - ถ้ามี)</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {availableRooms.length === 0 ? <p className="col-span-full text-gray-500 text-sm">ไม่มีห้องว่างในประเภทนี้ (หรือยังไม่ได้สร้างข้อมูลห้อง)</p> :
                                availableRooms.map(r => (
                                    <button key={r.id}
                                        type="button"
                                        onClick={() => setSelectedRoomId(r.id)}
                                        className={`p-2 rounded border text-center text-sm ${selectedRoomId === r.id ? 'bg-green-600 text-white border-green-600' : 'bg-white hover:bg-gray-50'}`}
                                    >
                                        {r.number}
                                    </button>
                                ))
                            }
                        </div>
                    </section>
                )}
            </div>

            {/* Right Column: Guest & Summary */}
            <div className="space-y-6">
                <section className="bg-white border rounded-lg p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">ข้อมูลผู้เข้าพัก</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-gray-500">ชื่อ-นามสกุล</label>
                            <input type="text" value={guestInfo.fullName} onChange={e => setGuestInfo({ ...guestInfo, fullName: e.target.value })} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500">เบอร์โทรศัพท์</label>
                            <input type="tel" value={guestInfo.phone} onChange={e => setGuestInfo({ ...guestInfo, phone: e.target.value })} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500">LINE ID (Optional)</label>
                            <input type="text" value={guestInfo.lineUserId} onChange={e => setGuestInfo({ ...guestInfo, lineUserId: e.target.value })} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500">Note</label>
                            <textarea value={guestInfo.note} onChange={e => setGuestInfo({ ...guestInfo, note: e.target.value })} className="w-full border rounded p-2 text-sm" rows={2} />
                        </div>
                    </div>
                </section>

                <section className="bg-gray-50 border rounded-lg p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">สรุปรายการ</h2>
                    <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between"><span>ประเภทห้อง</span><span className="font-medium">{selectedRoomType?.name || '-'}</span></div>
                        <div className="flex justify-between"><span>จำนวนคืน</span><span>{nights} คืน</span></div>
                        <div className="flex justify-between"><span>ราคาต่อคืน</span><span>{selectedRoomType?.basePrice?.toLocaleString() || 0}</span></div>
                        <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                            <span>ราคารวม</span>
                            <span>{totalPrice.toLocaleString()} บาท</span>
                        </div>
                    </div>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400">
                        {isSubmitting ? 'Processing...' : 'Confirm Booking'}
                    </button>
                </section>
            </div>
        </div>
    );
}
