"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { useToast } from '@/app/components/Toast';
import { RoomType, Room } from '@/types';
import { createBooking } from '@/app/actions/appointmentActions';

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
    const [unavailableRoomIds, setUnavailableRoomIds] = useState<Set<string>>(new Set());

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

    // Check Availability
    useEffect(() => {
        if (!checkInDate || !checkOutDate) return;

        const checkAvailability = async () => {
            try {
                // Fetch active bookings 
                // Note: 'status' 'in' query supports up to 10 values.
                const q = query(
                    collection(db, 'appointments'),
                    where('bookingType', '==', 'room'),
                    where('status', 'in', ['pending', 'awaiting_confirmation', 'confirmed', 'in_progress'])
                );

                const snap = await getDocs(q);
                const occupied = new Set<string>();
                const userStart = new Date(checkInDate);
                const userEnd = new Date(checkOutDate);

                snap.docs.forEach(d => {
                    const data = d.data();
                    const bInfo = data.bookingInfo;
                    if (!bInfo?.checkInDate || !bInfo?.checkOutDate || !bInfo?.roomId) return;

                    const bStart = new Date(bInfo.checkInDate);
                    const bEnd = new Date(bInfo.checkOutDate);

                    // Check Overlap: (StartA < EndB) and (EndA > StartB)
                    if (bStart < userEnd && bEnd > userStart) {
                        occupied.add(bInfo.roomId);
                    }
                });
                setUnavailableRoomIds(occupied);
            } catch (e) {
                console.error("Error checking availability:", e);
            }
        };

        checkAvailability();
    }, [checkInDate, checkOutDate]);

    // Filter available rooms
    const availableRooms = useMemo(() => {
        if (!selectedRoomTypeId) return [];
        return rooms.filter(r => r.roomTypeId === selectedRoomTypeId);
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
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                showToast('Unauthorized', 'error');
                setIsSubmitting(false);
                return;
            }

            const bookingData = {
                userId: guestInfo.lineUserId || undefined,
                roomTypeId: selectedRoomTypeId,
                roomId: selectedRoomId || null,
                checkInDate,
                checkOutDate,
                nights,
                rooms: 1,
                status: 'pending',
                customerInfo: guestInfo,
                paymentInfo: {
                    totalPrice,
                    paymentStatus: 'unpaid'
                },
                createdBy: { type: 'admin', id: auth.currentUser?.uid }
            };

            const res = await createBooking(bookingData, { adminToken: token });
            if (!res.success) {
                showToast(typeof res.error === 'string' ? res.error : 'Create booking failed', 'error');
                return;
            }
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
                        {roomTypes.map(rt => {
                            const isSelected = selectedRoomTypeId === rt.id;
                            return (
                                <div key={rt.id} onClick={() => { setSelectedRoomTypeId(rt.id!); setSelectedRoomId(''); }}
                                    className={`cursor-pointer border rounded-lg p-4 flex gap-4 transition-all duration-200 ${isSelected ? 'shadow-md scale-[1.01]' : 'hover:bg-gray-50 border-gray-200'}`}
                                    style={isSelected ? { backgroundColor: '#1f2937', color: 'white', borderColor: '#1f2937' } : {}}
                                >
                                    <div className="w-16 h-16 bg-gray-200 rounded-md object-cover flex-shrink-0"></div>
                                    <div>
                                        <div className={`font-medium text-lg ${isSelected ? 'text-white' : 'text-gray-900'}`}>{rt.name || 'Room Name'}</div>
                                        <div className={`text-sm ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>{rt.basePrice?.toLocaleString()} บาท/คืน</div>
                                        <div className={`text-xs mt-1 ${isSelected ? 'text-gray-400' : 'text-gray-400'}`}>พักได้ {rt.maxGuests} ท่าน</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 3. Room Selection (Optional) */}
                {selectedRoomTypeId && (
                    <section className="bg-white border rounded-lg p-5">
                        <h2 className="font-semibold text-gray-900 mb-4">3. เลือกห้อง (ระบุหมายเลขห้อง - ถ้ามี)</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {availableRooms.length === 0 ? <p className="col-span-full text-gray-500 text-sm">ไม่มีห้องว่างในประเภทนี้ (หรือยังไม่ได้สร้างข้อมูลห้อง)</p> :
                                availableRooms.map(r => {
                                    const isOccupied = unavailableRoomIds.has(r.id);
                                    const isSelected = selectedRoomId === r.id;
                                    return (
                                        <button key={r.id}
                                            type="button"
                                            disabled={isOccupied}
                                            onClick={() => setSelectedRoomId(r.id)}
                                            className={`p-3 rounded-lg border text-center text-sm font-medium relative overflow-hidden transition-all
                                                ${isSelected ? 'shadow-md scale-105' :
                                                    isOccupied ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed' :
                                                        'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'}`}
                                            style={isSelected ? { backgroundColor: '#2563eb', color: 'white', borderColor: '#2563eb' } : {}}
                                        >
                                            {r.number || r.id}
                                            {isOccupied && <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 text-[10px] text-red-500 font-bold rotate-12">ไม่ว่าง</div>}
                                        </button>
                                    );
                                })
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
