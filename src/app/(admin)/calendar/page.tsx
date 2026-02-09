"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, addDays } from "date-fns";
import { db } from "@/app/lib/firebase";
import { useToast } from "@/app/components/Toast";
import { Appointment, Technician } from "@/types";
import { useRouter } from "next/navigation";
import { blockAppointmentSlot } from "@/app/actions/blockActions";

const statusStyles: Record<string, string> = {
    awaiting_confirmation: "bg-yellow-100 text-yellow-800",
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800",
    blocked: "bg-gray-600 text-white opacity-80",
};

const statusLabels: Record<string, string> = {
    awaiting_confirmation: "รอยืนยัน",
    pending: "รออนุมัติ",
    confirmed: "ยืนยันแล้ว",
    completed: "เสร็จสิ้น",
    cancelled: "ยกเลิก",
    blocked: "ปิดกั้น/ไม่ว่าง",
};

const formatDateKey = (date: Date) => format(date, "yyyy-MM-dd");

export default function CalendarPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [techniciansList, setTechniciansList] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));

    const [viewMode, setViewMode] = useState<"calendar" | "timeline">("calendar");
    const [isBlockMode, setIsBlockMode] = useState(false);
    const [blockModal, setBlockModal] = useState<{ isOpen: boolean; techId: string | null; time: string | null }>({ isOpen: false, techId: null, time: null });
    const [blockReason, setBlockReason] = useState("");
    const [blockDuration, setBlockDuration] = useState(60);

    // Fetch Technicians
    useEffect(() => {
        const fetchTechnicians = async () => {
            try {
                // Fetch all technicians to ensure we see everyone.
                const q = query(collection(db, "technicians"), orderBy("firstName"));
                const snap = await getDocs(q);
                setTechniciansList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Technician)));
            } catch (error) {
                console.error("Error fetching technicians:", error);
            }
        };
        fetchTechnicians();
    }, []);

    useEffect(() => {
        const fetchAppointments = async () => {
            setLoading(true);
            try {
                const monthStart = startOfMonth(activeMonth);
                const monthEnd = endOfMonth(activeMonth);
                const q = query(
                    collection(db, "appointments"),
                    orderBy("date"),
                    where("date", ">=", formatDateKey(monthStart)),
                    where("date", "<=", formatDateKey(monthEnd))
                );
                const snap = await getDocs(q);
                setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));

                const sel = new Date(selectedDate);
                if (sel.getMonth() !== activeMonth.getMonth() || sel.getFullYear() !== activeMonth.getFullYear()) {
                    setSelectedDate(formatDateKey(activeMonth));
                }
            } catch (e) {
                console.error(e);
                showToast("ไม่สามารถโหลดข้อมูลได้", "error");
            } finally { setLoading(false); }
        };
        fetchAppointments();
    }, [activeMonth, showToast]);

    const appointmentsByDate = useMemo(() => {
        return appointments.reduce((acc, apt) => {
            if (!apt.date) return acc;
            const key = typeof apt.date === 'string' ? apt.date : format(apt.date.toDate(), 'yyyy-MM-dd');
            if (!acc[key]) acc[key] = [];
            acc[key].push(apt);
            return acc;
        }, {} as Record<string, Appointment[]>);
    }, [appointments]);

    const calendarDays = useMemo(() => {
        const firstDay = startOfMonth(activeMonth);
        const startDay = addDays(firstDay, -firstDay.getDay());
        return Array.from({ length: 42 }, (_, i) => {
            const date = addDays(startDay, i);
            const dateKey = formatDateKey(date);
            return {
                date, dateKey,
                isCurrentMonth: date.getMonth() === activeMonth.getMonth(),
                isToday: dateKey === formatDateKey(new Date()),
                appointments: appointmentsByDate[dateKey] || [],
            };
        });
    }, [activeMonth, appointmentsByDate]);

    const selectedAppointments = appointmentsByDate[selectedDate] || [];

    // Timeline helpers
    const timeSlots = useMemo(() => Array.from({ length: 13 }, (_, i) => `${(9 + i).toString().padStart(2, '0')}:00`), []);
    const parseTime = (t: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const timeToPosition = (t: string) => ((parseTime(t) - 540) / 720) * 100;
    const durationToHeight = (d: number) => (d / 720) * 100;

    const technicians = useMemo(() => {
        const techMap = new Map();

        // 1. Add from Master List
        techniciansList.forEach(t => {
            techMap.set(t.id, { id: t.id, name: `${t.firstName} ${t.lastName || ''}`.trim() });
        });

        // 2. Add from Appointments (fallback)
        selectedAppointments.forEach((apt: any) => {
            if (apt.technicianInfo?.id) {
                const id = apt.technicianInfo.id;
                if (!techMap.has(id)) techMap.set(id, { id, name: `${apt.technicianInfo.firstName || ''} ${apt.technicianInfo.lastName || ''}`.trim() });
            }
        });

        if (techMap.size === 0) techMap.set('default', { id: 'default', name: 'ทั้งหมด' });

        // Return active technicians first (from list), then others.
        // Actually Map insertion order is preserved, so list comes first.
        return Array.from(techMap.values());
    }, [selectedAppointments, techniciansList]);

    const appointmentsByTechnician = useMemo(() => {
        const byTech: any = {};
        technicians.forEach((t: any) => byTech[t.id] = []);
        selectedAppointments.forEach((apt: any) => {
            const id = apt.technicianId || apt.technicianInfo?.id || 'default';
            if (byTech[id] === undefined && !technicians.some((t: any) => t.id === id)) {
                if (byTech['default']) byTech['default'].push(apt);
            } else if (byTech[id]) {
                byTech[id].push(apt);
            }
        });

        Object.values(byTech).forEach((apts: any) => {
            apts.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
            apts.forEach((apt: any, idx: number) => {
                const start = parseTime(apt.time || '09:00');
                const end = start + (apt.serviceInfo?.duration || apt.appointmentInfo?.duration || 60);
                const overlapping = apts.filter((o: any, i: number) => i !== idx && parseTime(o.time || '09:00') < end && parseTime(o.time || '09:00') + (o.serviceInfo?.duration || o.appointmentInfo?.duration || 60) > start);
                apt._totalColumns = overlapping.length + 1;
                const used = new Set(overlapping.map((o: any) => o._column).filter((c: any) => c !== undefined));
                for (let c = 0; c < apt._totalColumns; c++) { if (!used.has(c)) { apt._column = c; break; } }
            });
        });
        return byTech;
    }, [selectedAppointments, technicians]);

    const handleDayNav = (dir: number) => {
        const d = addDays(new Date(selectedDate), dir);
        setSelectedDate(formatDateKey(d));
        if (d.getMonth() !== activeMonth.getMonth()) setActiveMonth(startOfMonth(d));
    };

    const handleSlotClick = (techId: string, time: string) => {
        if (isBlockMode) {
            setBlockModal({ isOpen: true, techId, time });
            return;
        }
        const params = new URLSearchParams();
        params.set('date', selectedDate);
        params.set('time', time);
        if (techId !== 'default') params.set('technicianId', techId);

        window.open(`/create-appointment?${params.toString()}`, '_blank');
    };

    const confirmBlockPayload = async () => {
        if (!blockModal.time || !blockModal.techId) return;
        setLoading(true);
        try {
            await blockAppointmentSlot({
                date: selectedDate,
                time: blockModal.time,
                technicianId: blockModal.techId === 'default' ? undefined : blockModal.techId,
                duration: blockDuration,
                note: blockReason || 'Not Available'
            });
            showToast('บันทึกการปิดกั้นสำเร็จ', 'success');
            setBlockModal({ isOpen: false, techId: null, time: null });
            setBlockReason("");
            // Refresh data - ideally relocate fetch logic to a useCallback
            window.location.reload(); // Quick fix for now or invoke fetch
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">ปฏิทินนัดหมาย</h1>
                    <p className="text-sm text-gray-500">จัดการและดูตารางนัดหมาย</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => router.push('/create-appointment')} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        สร้างนัดหมาย
                    </button>
                    <div className="flex items-center gap-1 bg-white border rounded-md p-1">
                        <button onClick={() => setViewMode("calendar")} className={`px-3 py-1.5 text-sm font-medium rounded-md ${viewMode === "calendar" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>ปฏิทิน</button>
                        <button onClick={() => setViewMode("timeline")} className={`px-3 py-1.5 text-sm font-medium rounded-md ${viewMode === "timeline" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>เส้นเวลา</button>
                    </div>
                    <button
                        onClick={() => setIsBlockMode(!isBlockMode)}
                        className={`flex items-center gap-1 border px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isBlockMode ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        {isBlockMode ? 'โหมดปิดกั้นพื้นที่' : 'ปิดกั้นช่วงเวลา'}
                    </button>
                    {isBlockMode && <span className="text-xs text-red-600 font-medium animate-pulse">เลือกช่วงเวลาเพื่อปิดกั้น</span>}
                </div>
            </div>

            {blockModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
                        <h3 className="text-lg font-semibold mb-4">ปิดกั้นช่วงเวลา</h3>
                        <p className="text-sm text-gray-600 mb-2">
                            {blockModal.techId !== 'default' && technicians.find(t => t.id === blockModal.techId)?.name}
                            <br />
                            เวลา {blockModal.time} น. ({selectedDate})
                        </p>
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="text-xs font-medium text-gray-700 mb-1 block">ระยะเวลา (นาที)</label>
                                <select value={blockDuration} onChange={e => setBlockDuration(Number(e.target.value))} className="w-full border rounded p-2 text-sm">
                                    <option value={30}>30 นาที</option>
                                    <option value={60}>1 ชั่วโมง</option>
                                    <option value={120}>2 ชั่วโมง</option>
                                    <option value={180}>3 ชั่วโมง</option>
                                    <option value={240}>4 ชั่วโมง</option>
                                    <option value={480}>ทั้งวัน (8 ชม.)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-700 mb-1 block">เหตุผล</label>
                                <input
                                    type="text"
                                    value={blockReason}
                                    onChange={e => setBlockReason(e.target.value)}
                                    placeholder="เช่น พักเที่ยง, ลากิจ, ซ่อมเครื่อง"
                                    className="w-full border rounded p-2 text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setBlockModal({ isOpen: false, techId: null, time: null })} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">ยกเลิก</button>
                            <button onClick={confirmBlockPayload} className="px-3 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded">ยืนยันปิดกั้น</button>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === "calendar" ? (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Calendar Grid */}
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-medium text-gray-900">{activeMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</h2>
                            <div className="flex gap-1">
                                <button onClick={() => setActiveMonth(p => subMonths(p, 1))} className="p-2 rounded-md border hover:bg-gray-50">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button onClick={() => setActiveMonth(p => addMonths(p, 1))} className="p-2 rounded-md border hover:bg-gray-50">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
                            {"อา จ อ พ พฤ ศ ส".split(" ").map(d => <div key={d}>{d}</div>)}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map(({ date, dateKey, isCurrentMonth, isToday, appointments: dayApts }) => {
                                const isSelected = selectedDate === dateKey;
                                return (
                                    <button
                                        key={dateKey}
                                        onClick={() => setSelectedDate(dateKey)}
                                        className={`h-24 p-2 rounded-lg text-left border transition-all flex flex-col justify-start relative group
                                            ${isSelected
                                                ? "border-gray-900 ring-1 ring-gray-900 bg-white z-10"
                                                : isCurrentMonth
                                                    ? "border-gray-100 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm"
                                                    : "border-transparent bg-gray-50/50 text-gray-400"
                                            } 
                                            ${isToday ? "bg-blue-50/30" : ""}
                                        `}
                                    >
                                        <div className="flex items-start justify-between w-full mb-1">
                                            <div className="flex items-center justify-center">
                                                <span className={`text-sm font-semibold leading-none w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : isSelected ? "text-gray-900" : ""}`}>
                                                    {date.getDate()}
                                                </span>
                                            </div>
                                            {dayApts.length > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium leading-none ${isSelected ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                                                    {dayApts.length}
                                                </span>
                                            )}
                                        </div>

                                        {dayApts.length > 0 && (
                                            <div className="w-full space-y-1 overflow-hidden mt-1">
                                                <div className="flex gap-px h-1 w-full rounded-full overflow-hidden bg-gray-100">
                                                    {/* Mini status bar */}
                                                    {dayApts.map((apt, i) => {
                                                        const color = apt.status === 'confirmed' ? 'bg-green-500' :
                                                            apt.status === 'completed' ? 'bg-blue-500' :
                                                                apt.status === 'cancelled' ? 'bg-red-300' : 'bg-yellow-400';
                                                        return <div key={i} className={`h-full flex-1 ${color}`} />
                                                    })}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    {dayApts.slice(0, 2).map((apt, i) => ( // Show max 2 items
                                                        <div key={i} className="flex items-center gap-1">
                                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${apt.status === 'confirmed' ? 'bg-green-500' :
                                                                apt.status === 'completed' ? 'bg-blue-500' :
                                                                    apt.status === 'cancelled' ? 'bg-red-500' : 'bg-yellow-500'
                                                                }`} />
                                                            <span className="text-[10px] text-gray-600 truncate leading-tight">
                                                                {apt.customerInfo?.fullName || apt.customerInfo?.name || 'ลูกค้า'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {dayApts.length > 2 && (
                                                        <span className="text-[10px] text-gray-400 pl-2.5 leading-none">
                                                            +{dayApts.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="w-full lg:w-80 bg-white border border-gray-200 rounded-lg p-5">
                        <div className="mb-4">
                            <p className="text-xs text-gray-500 uppercase">รายการในวัน</p>
                            <h3 className="text-lg font-medium text-gray-900">{new Date(selectedDate).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</h3>
                        </div>

                        {selectedAppointments.length === 0 ? (
                            <div className="text-center text-gray-400 border border-dashed rounded-md p-8">ไม่มีนัดหมาย</div>
                        ) : (
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                {selectedAppointments.sort((a, b) => ((a.time as string) || "").localeCompare((b.time as string) || "")).map(apt => {
                                    const duration = apt.serviceInfo?.duration || apt.appointmentInfo?.duration || 60;
                                    const [h, m] = ((apt.time as string) || "09:00").split(":").map(Number);
                                    const endM = h * 60 + m + duration;
                                    const end = `${Math.floor(endM / 60).toString().padStart(2, "0")}:${(endM % 60).toString().padStart(2, "0")}`;
                                    return (
                                        <a key={apt.id} href={`/appointments/${apt.id}`} target="_blank" rel="noopener noreferrer" className="block border rounded-md p-3 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-gray-900">{apt.time || "--:--"} - {end}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${statusStyles[apt.status] || "bg-gray-100 text-gray-700"}`}>{statusLabels[apt.status]}</span>
                                            </div>
                                            <p className="text-sm text-gray-800">{apt.customerInfo?.fullName || "ลูกค้า"}</p>
                                            <p className="text-xs text-gray-500">{apt.serviceInfo?.name || "บริการ"}</p>
                                            {(apt as any).technicianInfo?.firstName && <p className="text-xs text-gray-400 mt-1">ช่าง: {(apt as any).technicianInfo.firstName}</p>}
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Timeline View */
                <div className="bg-white border border-gray-200 rounded-lg p-5 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-gray-900">{new Date(selectedDate).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
                        <div className="flex gap-1">
                            <button onClick={() => handleDayNav(-1)} className="p-2 rounded-md border hover:bg-gray-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button onClick={() => handleDayNav(1)} className="p-2 rounded-md border hover:bg-gray-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-2">
                        <div className="min-w-max">
                            <div className="flex border-b">
                                <div className="w-16 flex-shrink-0 border-r bg-gray-50 p-2 text-xs font-medium text-gray-500 text-center sticky left-0 z-20">เวลา</div>
                                {technicians.map((t: any) => <div key={t.id} className="flex-1 min-w-[200px] border-r last:border-r-0 bg-gray-50 p-3 text-sm font-medium text-gray-700 text-center">{t.name}</div>)}
                            </div>

                            <div className="relative flex">
                                <div className="w-16 flex-shrink-0 border-r sticky left-0 z-20 bg-white">
                                    {timeSlots.map(t => <div key={t} className="h-20 border-b flex items-start justify-end pr-2 pt-1 text-xs text-gray-400">{t}</div>)}
                                </div>

                                {technicians.map((t: any) => (
                                    <div key={t.id} className="flex-1 min-w-[200px] border-r last:border-r-0 relative">
                                        {timeSlots.map(time => (
                                            <div
                                                key={time}
                                                className="h-20 border-b bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => handleSlotClick(t.id, time)}
                                                title={`จองคิว ${t.name} เวลา ${time}`}
                                            />
                                        ))}

                                        <div className="absolute inset-0 pointer-events-none">
                                            {appointmentsByTechnician[t.id]?.map((apt: any) => {
                                                const duration = apt.serviceInfo?.duration || apt.appointmentInfo?.duration || 60;
                                                const top = timeToPosition(apt.time || "09:00");
                                                const height = durationToHeight(duration);
                                                const col = apt._column || 0;
                                                const total = apt._totalColumns || 1;
                                                const w = 100 / total;
                                                return (
                                                    <a key={apt.id} href={`/appointments/${apt.id}`} target="_blank" rel="noopener noreferrer"
                                                        className={`absolute rounded-md border p-2 pointer-events-auto cursor-pointer hover:shadow-md transition-shadow ${statusStyles[apt.status] || "bg-gray-100"}`}
                                                        style={{ top: `${top}%`, height: `${height}%`, left: `${col * w}%`, width: `${w - 1}%`, minHeight: '40px', zIndex: 10 }}>
                                                        <div className="text-xs font-semibold">{apt.time || "--:--"}</div>
                                                        <div className="text-xs truncate font-medium">{apt.customerInfo?.fullName || "ลูกค้า"}</div>
                                                        <div className="text-xs text-gray-600 truncate">{apt.serviceInfo?.name}</div>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
