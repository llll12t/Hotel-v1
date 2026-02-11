"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { format, addDays, startOfMonth, endOfMonth, addMonths, subMonths, differenceInCalendarDays, isSameDay } from "date-fns";
import { th } from "date-fns/locale";
import { db } from "@/app/lib/firebase";
import { useToast } from "@/app/components/Toast";
import { useRouter } from "next/navigation";

// ===== Types =====
interface RoomData {
    id: string;
    number: string;
    roomTypeId: string;
    floor?: number;
}
interface RoomTypeData {
    id: string;
    name: string;
    basePrice?: number;
}
interface BookingData {
    id: string;
    status: string;
    bookingType?: string;
    date?: string;
    customerInfo?: { fullName?: string; name?: string; phone?: string };
    bookingInfo?: { roomTypeId?: string; roomId?: string; checkInDate?: string; checkOutDate?: string; nights?: number };
    roomTypeInfo?: { id?: string; name?: string };
    serviceInfo?: { name?: string };
    paymentInfo?: { totalPrice?: number; paymentStatus?: string };
}

// ===== Status Config =====
const STATUS_CONFIG: Record<string, { color: string; label: string; stripe?: string }> = {
    pending: { color: "bg-amber-400", label: "รอชำระ" },
    awaiting_confirmation: { color: "bg-amber-400", label: "รอยืนยัน" },
    confirmed: { color: "bg-emerald-400", label: "ยืนยันแล้ว" },
    in_progress: { color: "bg-cyan-400", label: "เช็คอินแล้ว" },
    completed: { color: "bg-blue-400", label: "เช็คเอาท์แล้ว" },
    cancelled: { color: "bg-red-400", label: "ยกเลิก" },
    blocked: { color: "bg-gray-500", label: "ปิดกั้น" },
};

const formatDateKey = (date: Date) => format(date, "yyyy-MM-dd");

export default function BookingCalendarPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
    const [rooms, setRooms] = useState<RoomData[]>([]);
    const [roomTypes, setRoomTypes] = useState<RoomTypeData[]>([]);
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);

    // Days to display (entire month)
    const daysInView = useMemo(() => {
        const start = startOfMonth(activeMonth);
        const end = endOfMonth(activeMonth);
        const totalDays = differenceInCalendarDays(end, start) + 1;
        return Array.from({ length: totalDays }, (_, i) => addDays(start, i));
    }, [activeMonth]);

    // Fetch data
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                // Rooms
                const roomSnap = await getDocs(query(collection(db, "rooms"), orderBy("number")));
                const roomsData = roomSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomData));
                setRooms(roomsData);

                // Room Types
                const rtSnap = await getDocs(query(collection(db, "roomTypes"), orderBy("name")));
                setRoomTypes(rtSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomTypeData)));

                // Bookings for this month (with buffer for spanning bookings)
                const monthStart = formatDateKey(addDays(startOfMonth(activeMonth), -7));
                const monthEnd = formatDateKey(addDays(endOfMonth(activeMonth), 7));
                const q = query(
                    collection(db, "appointments"),
                    where("bookingType", "==", "room"),
                    where("date", ">=", monthStart),
                    where("date", "<=", monthEnd)
                );
                const bookSnap = await getDocs(q);
                setBookings(bookSnap.docs.map(d => ({ id: d.id, ...d.data() } as BookingData)));
            } catch (e) {
                console.error(e);
                showToast("ไม่สามารถโหลดข้อมูลได้", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [activeMonth]);

    // Group rooms by room type
    const groupedRooms = useMemo(() => {
        const groups: { roomType: RoomTypeData; rooms: RoomData[] }[] = [];
        const rtMap = new Map(roomTypes.map(rt => [rt.id, rt]));

        // Group rooms
        const byType = new Map<string, RoomData[]>();
        rooms.forEach(r => {
            const arr = byType.get(r.roomTypeId) || [];
            arr.push(r);
            byType.set(r.roomTypeId, arr);
        });

        // Build groups in roomType order
        roomTypes.forEach(rt => {
            const rtRooms = byType.get(rt.id) || [];
            if (rtRooms.length > 0) {
                groups.push({ roomType: rt, rooms: rtRooms.sort((a, b) => a.number.localeCompare(b.number)) });
            }
        });

        return groups;
    }, [rooms, roomTypes]);

    // Compute booking bars positions
    const getBookingBars = (roomId: string) => {
        return bookings
            .filter(b => b.bookingInfo?.roomId === roomId && b.status !== 'cancelled')
            .map(b => {
                const checkIn = b.bookingInfo?.checkInDate || b.date || '';
                const checkOut = b.bookingInfo?.checkOutDate || '';
                if (!checkIn) return null;

                const startDate = new Date(checkIn);
                const endDate = checkOut ? new Date(checkOut) : addDays(startDate, 1);
                const monthStart = daysInView[0];

                const dayIndexStart = differenceInCalendarDays(startDate, monthStart);
                const dayIndexEnd = differenceInCalendarDays(endDate, monthStart);

                // Pixel calculations (40px per day)
                // We start at 'Noon' (Half day) to allow visually sharing the cell
                const pxPerDay = 40;
                const halfDay = 20;

                const rawPxStart = (dayIndexStart * pxPerDay) + halfDay;
                const rawPxEnd = (dayIndexEnd * pxPerDay) + halfDay;

                const containerWidth = daysInView.length * pxPerDay;

                if (rawPxEnd <= 0 || rawPxStart >= containerWidth) return null;

                const left = Math.max(0, rawPxStart);
                const right = Math.min(containerWidth, rawPxEnd);
                const width = right - left;

                if (width <= 0) return null;

                return {
                    booking: b,
                    left,
                    width,
                    isClippedStart: rawPxStart < 0,
                    isClippedEnd: rawPxEnd > containerWidth,
                };
            })
            .filter(Boolean) as { booking: BookingData; left: number; width: number; isClippedStart: boolean; isClippedEnd: boolean }[];
    };

    const today = new Date();
    const todayKey = formatDateKey(today);
    const CELL_WIDTH = 40; // px per day

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Booking Calendar</h1>
                    <p className="text-sm text-gray-500">ตารางการจองห้องพักรายเดือน</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setActiveMonth(startOfMonth(new Date())); }}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        วันนี้
                    </button>
                    <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
                        <button onClick={() => setActiveMonth(p => subMonths(p, 1))} className="p-2 rounded-md hover:bg-gray-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="px-4 py-1 text-sm font-semibold text-gray-900 min-w-[140px] text-center">
                            {format(activeMonth, "MMMM yyyy", { locale: th })}
                        </span>
                        <button onClick={() => setActiveMonth(p => addMonths(p, 1))} className="p-2 rounded-md hover:bg-gray-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    <button
                        onClick={() => router.push('/appointments/create')}
                        className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        จองห้อง
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                {/* Legend & Summary Bar */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="flex-1">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">สถานะการจอง</h3>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(STATUS_CONFIG).map(([key, { color, label }]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded ${color} flex-shrink-0`} />
                                    <span className="text-xs text-gray-600">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase">ห้องทั้งหมด</span>
                            <span className="text-sm font-bold text-gray-900">{rooms.length}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase">การจอง</span>
                            <span className="text-sm font-bold text-gray-900">{bookings.filter(b => b.status !== 'cancelled').length}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase">ยืนยันแล้ว</span>
                            <span className="text-sm font-bold text-emerald-600">{bookings.filter(b => b.status === 'confirmed' || b.status === 'in_progress').length}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase">รอชำระ</span>
                            <span className="text-sm font-bold text-amber-600">{bookings.filter(b => b.status === 'pending' || b.status === 'awaiting_confirmation').length}</span>
                        </div>
                    </div>
                </div>

                {/* Main Calendar Grid */}
                <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <div style={{ minWidth: `${180 + daysInView.length * CELL_WIDTH}px` }}>
                            {/* Date Header */}
                            <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
                                <div className="w-[180px] flex-shrink-0 border-r border-gray-200 p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    ห้องพัก
                                </div>
                                {daysInView.map(day => {
                                    const isToday = formatDateKey(day) === todayKey;
                                    const isSun = day.getDay() === 0;
                                    const isSat = day.getDay() === 6;
                                    return (
                                        <div
                                            key={formatDateKey(day)}
                                            className={`flex-shrink-0 border-r border-gray-100 text-center py-2 ${isToday ? 'bg-blue-50' : isSun || isSat ? 'bg-red-50/30' : ''}`}
                                            style={{ width: `${CELL_WIDTH}px` }}
                                        >
                                            <div className={`text-[10px] font-medium ${isSun || isSat ? 'text-red-400' : 'text-gray-400'}`}>
                                                {format(day, "EEE", { locale: th })}
                                            </div>
                                            <div className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full mx-auto flex items-center justify-center' : isSun || isSat ? 'text-red-500' : 'text-gray-700'}`}>
                                                {day.getDate()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Room Rows */}
                            {groupedRooms.map(({ roomType, rooms: rtRooms }) => (
                                <div key={roomType.id}>
                                    {/* Room Type Header */}
                                    <div className="flex border-b border-gray-200 bg-gray-50/70">
                                        <div className="w-[180px] flex-shrink-0 border-r border-gray-200 px-3 py-2">
                                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{roomType.name}</span>
                                            {roomType.basePrice && (
                                                <span className="text-[10px] text-gray-400 ml-2">฿{roomType.basePrice?.toLocaleString()}/คืน</span>
                                            )}
                                        </div>
                                        <div className="flex-1" />
                                    </div>

                                    {/* Individual Room Rows */}
                                    {rtRooms.map(room => {
                                        const bars = getBookingBars(room.id);
                                        return (
                                            <div key={room.id} className="flex border-b border-gray-100 hover:bg-gray-50/30 transition-colors group">
                                                {/* Room Label */}
                                                <div className="w-[180px] flex-shrink-0 border-r border-gray-200 px-3 py-3 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                                                    <span className="text-sm font-medium text-gray-800">ห้อง {room.number}</span>
                                                    {room.floor && <span className="text-[10px] text-gray-400">ชั้น {room.floor}</span>}
                                                </div>

                                                {/* Day Cells + Booking Bars */}
                                                <div className="flex-1 relative" style={{ height: '44px' }}>
                                                    {/* Grid Lines */}
                                                    <div className="absolute inset-0 flex">
                                                        {daysInView.map(day => {
                                                            const isToday = formatDateKey(day) === todayKey;
                                                            return (
                                                                <div
                                                                    key={formatDateKey(day)}
                                                                    className={`flex-shrink-0 border-r border-gray-50 ${isToday ? 'bg-blue-50/40' : ''}`}
                                                                    style={{ width: `${CELL_WIDTH}px` }}
                                                                />
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Booking Bars */}
                                                    {bars.map(({ booking, left, width, isClippedStart, isClippedEnd }) => {
                                                        const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                                                        const isHovered = hoveredBooking === booking.id;
                                                        const guestName = booking.customerInfo?.fullName || booking.customerInfo?.name || '';
                                                        return (
                                                            <div
                                                                key={booking.id}
                                                                className={`absolute top-[6px] h-[32px] ${cfg.color} cursor-pointer transition-all duration-150 flex items-center overflow-hidden group/bar
                                                                    ${isHovered ? 'ring-2 ring-gray-900 shadow-lg z-30 scale-y-110' : 'z-10 hover:brightness-95'}
                                                                    ${isClippedStart ? 'rounded-l-none' : 'rounded-l-md'}
                                                                    ${isClippedEnd ? 'rounded-r-none' : 'rounded-r-md'}
                                                                `}
                                                                style={{
                                                                    left: `${left}px`,
                                                                    width: `${Math.max(0, width - 1)}px`,
                                                                }}
                                                                onMouseEnter={() => setHoveredBooking(booking.id)}
                                                                onMouseLeave={() => setHoveredBooking(null)}
                                                                onClick={() => router.push(`/appointments/${booking.id}`)}
                                                                title={`${guestName} | ${booking.bookingInfo?.checkInDate} → ${booking.bookingInfo?.checkOutDate} | ${cfg.label}`}
                                                            >
                                                                {/* Diagonal stripes for pending */}
                                                                {(booking.status === 'pending' || booking.status === 'awaiting_confirmation') && (
                                                                    <div className="absolute inset-0 opacity-20"
                                                                        style={{
                                                                            backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 6px)',
                                                                        }}
                                                                    />
                                                                )}
                                                                <span className="text-[11px] font-semibold text-white truncate px-2 relative z-10 drop-shadow-sm">
                                                                    {guestName || '�'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Empty State */}
                            {groupedRooms.length === 0 && (
                                <div className="p-12 text-center text-gray-400">
                                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    <p className="font-medium">ยังไม่มีข้อมูลห้องพัก</p>
                                    <p className="text-sm mt-1">กรุณาสร้างประเภทห้องและห้องพักก่อน</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Legend Sidebar */}

            </div>
        </div>
    );
}
