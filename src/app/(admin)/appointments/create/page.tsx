"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { useToast } from '@/app/components/Toast';
import { RoomType, Room } from '@/types';
import { createBooking } from '@/app/actions/appointmentActions';

// ── Icons ───────────────────────────────────────────────────────────────────
const BackIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>;
const CalIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const BedIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const UserIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const CheckIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>;

// ── Field Label ─────────────────────────────────────────────────────────────
const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
        {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
);

// ── Input ───────────────────────────────────────────────────────────────────
const inputCls = "w-full border border-gray-200 bg-gray-50 rounded-md px-3.5 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-gray-900 outline-none transition-all";

// ── Section Card ────────────────────────────────────────────────────────────
const Section = ({ step, title, icon, children }: {
    step?: number; title: string; icon?: React.ReactNode; children: React.ReactNode;
}) => (
    <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
            {step && (
                <div className="w-6 h-6 rounded-lg bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {step}
                </div>
            )}
            {icon && !step && <span className="text-gray-400">{icon}</span>}
            <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        </div>
        <div className="p-5">{children}</div>
    </div>
);

// ── Main Page ───────────────────────────────────────────────────────────────
export default function CreateBookingPage() {
    const router = useRouter();
    const { showToast } = useToast();

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
                const rtSnap = await getDocs(query(collection(db, 'roomTypes'), orderBy('basePrice')));
                setRoomTypes(rtSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
                const rSnap = await getDocs(query(collection(db, 'rooms'), orderBy('number')));
                setRooms(rSnap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
            } catch (e) {
                console.error(e);
                showToast('โหลดข้อมูลล้มเหลว', 'error');
            }
            setLoading(false);
        };
        load();
    }, []);

    // Availability Check
    useEffect(() => {
        if (!checkInDate || !checkOutDate) return;
        const check = async () => {
            try {
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
                    const bInfo = d.data().bookingInfo;
                    if (!bInfo?.checkInDate || !bInfo?.checkOutDate || !bInfo?.roomId) return;
                    if (new Date(bInfo.checkInDate) < userEnd && new Date(bInfo.checkOutDate) > userStart) {
                        occupied.add(bInfo.roomId);
                    }
                });
                setUnavailableRoomIds(occupied);
            } catch (e) { console.error(e); }
        };
        check();
    }, [checkInDate, checkOutDate]);

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
            return showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        }
        setIsSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) { showToast('ไม่พบการยืนยันตัวตน', 'error'); setIsSubmitting(false); return; }
            const res = await createBooking({
                userId: guestInfo.lineUserId || undefined,
                roomTypeId: selectedRoomTypeId,
                roomId: selectedRoomId || null,
                checkInDate, checkOutDate, nights, rooms: 1,
                status: 'pending',
                customerInfo: guestInfo,
                paymentInfo: { totalPrice, paymentStatus: 'unpaid' },
                createdBy: { type: 'admin', id: auth.currentUser?.uid }
            }, { adminToken: token });
            if (!res.success) { showToast(typeof res.error === 'string' ? res.error : 'สร้างการจองล้มเหลว', 'error'); return; }
            showToast('สร้างการจองสำเร็จ', 'success');
            router.push('/dashboard');
        } catch (e: any) { showToast(e.message, 'error'); }
        finally { setIsSubmitting(false); }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-all"
                >
                    <BackIcon />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">สร้างการจองใหม่</h1>
                    <p className="text-xs text-gray-400 mt-0.5">กรอกข้อมูลเพื่อสร้างการจองห้องพัก</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── Left: Steps ───────────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Step 1 — Dates */}
                    <Section step={1} title="วันที่เข้าพัก" icon={<CalIcon />}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <FieldLabel required>Check-in</FieldLabel>
                                <input
                                    type="date"
                                    value={checkInDate}
                                    onChange={e => setCheckInDate(e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <FieldLabel required>Check-out</FieldLabel>
                                <input
                                    type="date"
                                    value={checkOutDate}
                                    onChange={e => setCheckOutDate(e.target.value)}
                                    min={checkInDate}
                                    className={inputCls}
                                />
                            </div>
                        </div>
                        <div className="mt-3 inline-flex items-center gap-2 bg-gray-50 border border-gray-100 px-4 py-2 rounded-md">
                            <CalIcon />
                            <span className="text-sm font-semibold text-gray-700">{nights} คืน</span>
                            <span className="text-xs text-gray-400">
                                ({format(new Date(checkInDate), 'dd/MM/yy')} → {format(new Date(checkOutDate), 'dd/MM/yy')})
                            </span>
                        </div>
                    </Section>

                    {/* Step 2 — Room Type */}
                    <Section step={2} title="ประเภทห้องพัก">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {roomTypes.map(rt => {
                                const isSelected = selectedRoomTypeId === rt.id;
                                const coverImage = rt.imageUrls?.find(url => Boolean(url));
                                return (
                                    <div
                                        key={rt.id}
                                        onClick={() => { setSelectedRoomTypeId(rt.id!); setSelectedRoomId(''); }}
                                        className={`cursor-pointer rounded-md border p-4 flex gap-4 items-center transition-all ${isSelected
                                            ? 'shadow-lg scale-[1.01] border-transparent'
                                            : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                            }`}
                                        style={isSelected ? { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' } : {}}
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
                                            {coverImage ? (
                                                <img src={coverImage} alt={rt.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                    <BedIcon />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-bold text-base truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                                {rt.name || 'Room'}
                                            </div>
                                            <div className={`text-sm font-semibold mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-700'}`}>
                                                {rt.basePrice?.toLocaleString()} <span className={`text-xs font-normal ${isSelected ? 'text-white/50' : 'text-gray-400'}`}>บาท/คืน</span>
                                            </div>
                                            <div className={`text-xs mt-1 flex items-center gap-1 ${isSelected ? 'text-white/50' : 'text-gray-400'}`}>
                                                <UserIcon />
                                                พักได้ {rt.maxGuests} ท่าน
                                            </div>
                                        </div>

                                        {/* Check */}
                                        {isSelected && (
                                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                                <CheckIcon />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Section>

                    {/* Step 3 — Room Number (Optional) */}
                    {selectedRoomTypeId && (
                        <Section step={3} title="เลขห้องพัก (ถ้ามี)">
                            {availableRooms.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-sm text-gray-400">ไม่มีห้องในประเภทนี้ หรือยังไม่ได้สร้างข้อมูลห้อง</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                    {/* None option */}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRoomId('')}
                                        className={`py-3 rounded-md border text-xs font-bold transition-all ${selectedRoomId === ''
                                            ? 'border-transparent text-white shadow-sm'
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                            }`}
                                        style={selectedRoomId === '' ? { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' } : {}}
                                    >
                                        ไม่ระบุ
                                    </button>
                                    {availableRooms.map(r => {
                                        const isOccupied = unavailableRoomIds.has(r.id);
                                        const isSelected = selectedRoomId === r.id;
                                        const displayLabel = r.number?.trim() || `#${r.id.slice(0, 3).toUpperCase()}`;
                                        return (
                                            <button
                                                key={r.id}
                                                type="button"
                                                disabled={isOccupied}
                                                onClick={() => setSelectedRoomId(r.id)}
                                                className={`py-3 rounded-md border text-xs font-bold relative transition-all ${isOccupied
                                                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'border-transparent text-white shadow-sm'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                style={isSelected && !isOccupied ? { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' } : {}}
                                            >
                                                {isOccupied ? (
                                                    <span className="line-through text-gray-300">{displayLabel}</span>
                                                ) : displayLabel}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </Section>
                    )}

                    {/* Step 4 — Guest Info */}
                    <Section step={4} title="ข้อมูลผู้เข้าพัก" icon={<UserIcon />}>
                        <div className="space-y-4">
                            <div>
                                <FieldLabel required>ชื่อ-นามสกุล</FieldLabel>
                                <input
                                    type="text"
                                    value={guestInfo.fullName}
                                    onChange={e => setGuestInfo({ ...guestInfo, fullName: e.target.value })}
                                    className={inputCls}
                                    placeholder="กรอกชื่อ-นามสกุล"
                                />
                            </div>
                            <div>
                                <FieldLabel>เบอร์โทรศัพท์</FieldLabel>
                                <input
                                    type="tel"
                                    value={guestInfo.phone}
                                    onChange={e => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                                    className={inputCls}
                                    placeholder="0xx-xxx-xxxx"
                                />
                            </div>
                            <div>
                                <FieldLabel>LINE User ID (ไม่บังคับ)</FieldLabel>
                                <input
                                    type="text"
                                    value={guestInfo.lineUserId}
                                    onChange={e => setGuestInfo({ ...guestInfo, lineUserId: e.target.value })}
                                    className={inputCls}
                                    placeholder="U..."
                                />
                            </div>
                            <div>
                                <FieldLabel>หมายเหตุ</FieldLabel>
                                <textarea
                                    value={guestInfo.note}
                                    onChange={e => setGuestInfo({ ...guestInfo, note: e.target.value })}
                                    className={`${inputCls} resize-none`}
                                    rows={3}
                                    placeholder="ความต้องการพิเศษ..."
                                />
                            </div>
                        </div>
                    </Section>
                </div>

                {/* ── Right: Summary ────────────────────────────────────── */}
                <div>
                    <div className="sticky top-20 space-y-4">
                        {/* Summary Card */}
                        <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-50">
                                <h2 className="text-sm font-bold text-gray-900">สรุปการจอง</h2>
                            </div>
                            <div className="p-5 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">ประเภทห้อง</span>
                                    <span className="font-semibold text-gray-900 text-right max-w-[55%] truncate">{selectedRoomType?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">เลขห้อง</span>
                                    <span className="font-semibold text-gray-900">{selectedRoomId ? (rooms.find(r => r.id === selectedRoomId)?.number || '-') : 'ยังไม่ระบุ'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">เช็คอิน</span>
                                    <span className="font-semibold text-gray-900">{format(new Date(checkInDate), 'dd/MM/yyyy')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">เช็คเอาท์</span>
                                    <span className="font-semibold text-gray-900">{format(new Date(checkOutDate), 'dd/MM/yyyy')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">จำนวนคืน</span>
                                    <span className="font-semibold text-gray-900">{nights} คืน</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">ราคา/คืน</span>
                                    <span className="font-semibold text-gray-900">{selectedRoomType?.basePrice?.toLocaleString() || '0'} บาท</span>
                                </div>

                                <div className="border-t border-dashed border-gray-200 my-1" />

                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-gray-900">ยอดรวม</span>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-gray-900">{totalPrice.toLocaleString()}</span>
                                        <span className="text-xs text-gray-400 ml-1">บาท</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Checklist */}
                        <div className="bg-gray-50 rounded-md border border-gray-100 p-4 space-y-2">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">ความพร้อม</p>
                            {[
                                { ok: !!checkInDate && !!checkOutDate, label: 'ระบุวันที่แล้ว' },
                                { ok: !!selectedRoomTypeId, label: 'เลือกประเภทห้องแล้ว' },
                                { ok: !!guestInfo.fullName.trim(), label: 'กรอกชื่อผู้เข้าพักแล้ว' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2.5 text-xs">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.ok ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                        {item.ok && <CheckIcon />}
                                    </div>
                                    <span className={item.ok ? 'text-gray-700 font-medium' : 'text-gray-400'}>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !selectedRoomTypeId || !guestInfo.fullName.trim()}
                            className="w-full py-3.5 text-sm font-bold text-white bg-[#1A1A1A] rounded-md hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-gray-900/10 active:scale-[0.98]"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    กำลังสร้างการจอง...
                                </span>
                            ) : 'ยืนยันการจอง →'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
