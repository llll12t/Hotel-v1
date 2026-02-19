"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '@/app/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { cancelAppointmentByAdmin } from '@/app/actions/appointmentActions';
import { format, startOfDay, endOfDay, parseISO, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';

// ── Types ──────────────────────────────────────────────────────────────────
interface Appointment {
    id: string;
    status: string;
    bookingType?: 'service' | 'room';
    customerInfo: {
        pictureUrl?: string;
        fullName?: string;
        name?: string;
        phone?: string;
    };
    appointmentInfo: {
        dateTime: any;
        addOns?: { duration: number }[];
    };
    serviceInfo: {
        name: string;
        duration: number;
        serviceType?: string;
    };
    paymentInfo: {
        totalPrice: number;
    };
    bookingInfo?: {
        checkInDate?: string;
        checkOutDate?: string;
        nights?: number;
        rooms?: number;
    };
    roomTypeInfo?: {
        name?: string;
    };
    parsedDate?: Date;
}

const parseAppointmentDate = (dateInfo: any): Date | null => {
    if (!dateInfo) return null;
    if (typeof dateInfo.toDate === 'function') return dateInfo.toDate();
    if (dateInfo instanceof Date) return dateInfo;
    if (typeof dateInfo === 'string') return new Date(dateInfo);
    if (dateInfo.seconds) return new Date(dateInfo.seconds * 1000);
    return null;
};

// ── Status Config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    awaiting_confirmation: { label: 'รอชำระ', dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
    pending: { label: 'รอชำระ', dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
    confirmed: { label: 'ชำระแล้ว', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
    in_progress: { label: 'เช็คอินแล้ว', dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
    completed: { label: 'เช็คเอาท์', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    cancelled: { label: 'ยกเลิก', dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-600' },
    blocked: { label: 'ไม่ว่าง', dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' },
};

const TABS = [
    { key: 'upcoming', label: 'กำลังดำเนินการ' },
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'confirmed', label: 'ชำระแล้ว' },
    { key: 'awaiting_confirmation', label: 'รอชำระ' },
    { key: 'completed', label: 'เช็คเอาท์' },
    { key: 'cancelled', label: 'ยกเลิก' },
];

// ── Icons ───────────────────────────────────────────────────────────────────
const ChevL = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>;
const ChevR = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>;
const GridIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const ListIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>;
const SearchIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;

// ── Cancel Modal ────────────────────────────────────────────────────────────
function CancelModal({ appointment, onClose, onConfirm }: {
    appointment: Appointment;
    onClose: () => void;
    onConfirm: (id: string, reason: string) => Promise<void>;
}) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async () => {
        if (!reason.trim()) { alert('กรุณาระบุเหตุผล'); return; }
        setIsSubmitting(true);
        await onConfirm(appointment.id, reason);
        setIsSubmitting(false);
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-md shadow-2xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">ยืนยันการยกเลิก</h2>
                <p className="text-sm text-gray-500 mb-4">ยกเลิกนัดหมายของ <span className="font-semibold text-gray-900">{appointment.customerInfo.name || appointment.customerInfo.fullName}</span>?</p>
                <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-900 outline-none mb-4 resize-none bg-gray-50"
                    placeholder="ระบุเหตุผล..."
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 font-medium transition-colors">ปิด</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-2.5 text-sm text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50 font-bold transition-colors shadow-sm">
                        {isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ title, value, subValue, dotColor, onClick, active }: {
    title: string; value: string | number; subValue?: string;
    dotColor: string; onClick?: () => void; active?: boolean;
}) => (
    <div
        onClick={onClick}
        className={`rounded-md p-4 cursor-pointer transition-all border ${active
            ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-lg scale-[1.02]'
            : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm text-gray-900'
            }`}
    >
        <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-white/60' : dotColor}`} />
            <p className={`text-xs font-semibold uppercase tracking-wider ${active ? 'text-white/70' : 'text-gray-400'}`}>{title}</p>
        </div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        {subValue && <p className={`text-xs mt-1 ${active ? 'text-white/50' : 'text-gray-400'}`}>{subValue}</p>}
    </div>
);

// ── Appointment Card ─────────────────────────────────────────────────────────
const AppointmentCard = ({ appointment, onCancelClick }: {
    appointment: Appointment;
    onCancelClick: (app: Appointment) => void;
}) => {
    const { profile } = useProfile();
    const router = useRouter();
    const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.cancelled;
    const isRoom = appointment.bookingType === 'room' || appointment.serviceInfo?.serviceType === 'room' || Boolean(appointment.bookingInfo?.checkInDate);
    const name = appointment.customerInfo?.fullName || appointment.customerInfo?.name || '-';
    const serviceName = appointment.roomTypeInfo?.name || appointment.serviceInfo?.name || '-';
    const checkIn = appointment.bookingInfo?.checkInDate;
    const checkOut = appointment.bookingInfo?.checkOutDate;
    const nights = appointment.bookingInfo?.nights;
    const price = (appointment.paymentInfo?.totalPrice || 0).toLocaleString();

    return (
        <div
            onClick={() => router.push(`/appointments/${appointment.id}`)}
            className="bg-white rounded-md border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all cursor-pointer group overflow-hidden"
        >
            {/* Color stripe top */}
            <div className={`h-1 w-full ${status.dot.replace('bg-', 'bg-')}`} />

            <div className="p-4">
                {/* Customer + Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {appointment.customerInfo?.pictureUrl ? (
                            <img src={appointment.customerInfo.pictureUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold flex-shrink-0">
                                {name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate leading-tight">{name}</p>
                            <p className="text-xs text-gray-400 truncate">{appointment.customerInfo?.phone || '-'}</p>
                        </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${status.bg} ${status.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                    </span>
                </div>

                {/* Room Info */}
                <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
                    <p className="text-xs font-bold text-gray-800 mb-1.5 truncate">{serviceName}</p>
                    {isRoom && checkIn && checkOut && (
                        <p className="text-[10px] text-gray-400 mb-1">
                            {format(parseISO(checkIn), 'dd MMM', { locale: th })} → {format(parseISO(checkOut), 'dd MMM yyyy', { locale: th })}
                        </p>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">
                            {isRoom ? `${nights || 1} คืน` : `${appointment.serviceInfo?.duration || 0} นาที`}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{price} <span className="text-[10px] text-gray-400 font-normal">{profile?.currencySymbol}</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Table Row ────────────────────────────────────────────────────────────────
const TableRow = ({ app, profile, router }: any) => {
    const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.cancelled;
    const name = app.customerInfo?.fullName || app.customerInfo?.name || '-';
    const roomName = app.roomTypeInfo?.name || app.serviceInfo?.name || '-';
    const checkIn = app.bookingInfo?.checkInDate;
    const checkOut = app.bookingInfo?.checkOutDate;
    return (
        <tr
            onClick={() => router.push(`/appointments/${app.id}`)}
            className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
        >
            <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                    {app.customerInfo?.pictureUrl ? (
                        <img src={app.customerInfo.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-100 flex-shrink-0" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs flex-shrink-0">
                            {name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-400">{app.customerInfo?.phone || '-'}</p>
                    </div>
                </div>
            </td>
            <td className="px-5 py-3.5 text-sm text-gray-700 font-medium">{roomName}</td>
            <td className="px-5 py-3.5 text-sm text-gray-500">{checkIn ? format(parseISO(checkIn), 'dd MMM yyyy', { locale: th }) : '-'}</td>
            <td className="px-5 py-3.5 text-sm text-gray-500">{checkOut ? format(parseISO(checkOut), 'dd MMM yyyy', { locale: th }) : '-'}</td>
            <td className="px-5 py-3.5 text-sm font-bold text-gray-900">{(app.paymentInfo?.totalPrice || 0).toLocaleString()} <span className="font-normal text-gray-400 text-xs">{profile?.currencySymbol}</span></td>
            <td className="px-5 py-3.5">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${status.bg} ${status.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                </span>
            </td>
            <td className="px-5 py-3.5 text-right">
                <span className="text-xs font-medium text-gray-400 hover:text-gray-900 transition-colors">ดูรายละเอียด →</span>
            </td>
        </tr>
    );
};

// ── Main Page ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const { profile, loading: profileLoading } = useProfile();
    const router = useRouter();

    const [filters, setFilters] = useState({
        startDate: format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
        search: '',
    });

    const isRoomBooking = (a: Appointment) =>
        a.bookingType === 'room' || a.serviceInfo?.serviceType === 'room' || Boolean(a.bookingInfo?.checkInDate);

    useEffect(() => {
        const q = query(collection(db, 'appointments'), orderBy('appointmentInfo.dateTime', 'desc'));
        const unsub = onSnapshot(q, snap => {
            const apps = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                parsedDate: parseAppointmentDate(d.data().appointmentInfo?.dateTime)
            } as Appointment));
            setAllAppointments(apps);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const roomAppointments = useMemo(() => allAppointments.filter(isRoomBooking), [allAppointments]);

    const filteredAppointments = useMemo(() => {
        const start = startOfDay(parseISO(filters.startDate));
        const end = endOfDay(parseISO(filters.endDate));
        const search = filters.search.toLowerCase();
        return roomAppointments.filter(app => {
            const date = app.parsedDate;
            if (!date || date < start || date > end) return false;
            if (search) {
                const fullName = (app.customerInfo?.fullName || app.customerInfo?.name || '').toLowerCase();
                const phone = app.customerInfo?.phone || '';
                if (!fullName.includes(search) && !phone.includes(search)) return false;
            }
            return true;
        });
    }, [roomAppointments, filters]);

    const stats = useMemo(() => {
        const today = new Date();
        const todayCount = roomAppointments.filter(a => a.parsedDate && isSameDay(a.parsedDate, today)).length;
        const pendingCount = roomAppointments.filter(a => ['awaiting_confirmation', 'pending'].includes(a.status)).length;
        const totalRevenue = filteredAppointments.reduce((sum, a) => sum + (a.status !== 'cancelled' ? (a.paymentInfo?.totalPrice || 0) : 0), 0);
        return { todayCount, pendingCount, totalRevenue, totalFiltered: filteredAppointments.length };
    }, [roomAppointments, filteredAppointments]);

    const tabAppointments = filteredAppointments.filter(a => {
        if (activeTab === 'all') return true;
        if (activeTab === 'upcoming') return ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'].includes(a.status);
        return a.status === activeTab;
    });
    const totalPages = Math.ceil(tabAppointments.length / itemsPerPage);
    const currentItems = tabAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => setCurrentPage(1), [activeTab, filters]);

    if (loading || profileLoading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">กำลังโหลด...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {appointmentToCancel && (
                <CancelModal
                    appointment={appointmentToCancel}
                    onClose={() => setAppointmentToCancel(null)}
                    onConfirm={async (id, reason) => {
                        const token = await auth.currentUser?.getIdToken();
                        if (!token) { alert('Unauthorized'); return; }
                        const res = await cancelAppointmentByAdmin(id, reason, { adminToken: token });
                        alert(res.success ? 'ยกเลิกสำเร็จ' : res.error);
                    }}
                />
            )}

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">ภาพรวมการจอง</h1>
                    <p className="text-sm text-gray-400 mt-0.5">จัดการการจองห้องพักและดูสถิติ</p>
                </div>
                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#1A1A1A] text-white' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                        <GridIcon />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-[#1A1A1A] text-white' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                        <ListIcon />
                    </button>
                </div>
            </div>

            {/* ── Stat Cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatCard
                    title="วันนี้" value={stats.todayCount} subValue="รายการ" dotColor="bg-blue-500"
                    onClick={() => { setFilters(p => ({ ...p, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') })); setActiveTab('all'); }}
                    active={isSameDay(parseISO(filters.startDate), new Date()) && isSameDay(parseISO(filters.endDate), new Date())}
                />
                <StatCard
                    title="รอชำระ" value={stats.pendingCount} subValue="รายการ" dotColor="bg-amber-400"
                    onClick={() => setActiveTab('awaiting_confirmation')}
                    active={activeTab === 'awaiting_confirmation'}
                />
                <StatCard
                    title="รายได้" value={stats.totalRevenue.toLocaleString()} subValue={profile?.currencySymbol} dotColor="bg-emerald-500"
                />
                <StatCard
                    title="ทั้งหมด" value={stats.totalFiltered} subValue="รายการ" dotColor="bg-gray-400"
                    onClick={() => setActiveTab('all')} active={activeTab === 'all'}
                />
            </div>

            {/* ── Filter + Tab Bar ─────────────────────────────────────── */}
            <div className="bg-white rounded-md border border-gray-100 px-4 py-3 mb-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Tabs */}
                    <div className="flex flex-wrap gap-1.5">
                        {TABS.map(tab => {
                            const count =
                                tab.key === 'all' ? filteredAppointments.length
                                    : tab.key === 'upcoming' ? filteredAppointments.filter(a => ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'].includes(a.status)).length
                                        : filteredAppointments.filter(a => a.status === tab.key).length;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === tab.key
                                        ? 'bg-[#1A1A1A] text-white shadow-sm'
                                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {tab.label}
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-2 rounded-md text-xs">
                            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="bg-transparent text-gray-700 outline-none w-26" />
                            <span className="text-gray-300 font-light">—</span>
                            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="bg-transparent text-gray-700 outline-none w-26" />
                        </div>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><SearchIcon /></div>
                            <input
                                type="text" name="search" placeholder="ค้นหาชื่อหรือเบอร์..."
                                value={filters.search} onChange={handleFilterChange}
                                className="pl-9 pr-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-xs text-gray-800 outline-none focus:ring-2 focus:ring-gray-900 w-full sm:w-44 transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Content ──────────────────────────────────────────────── */}
            {currentItems.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {currentItems.map(app => (
                                <AppointmentCard key={app.id} appointment={app} onCancelClick={setAppointmentToCancel} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">ลูกค้า</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">ห้องพัก</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">เช็คอิน</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">เช็คเอาท์</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">ราคา</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">สถานะ</th>
                                        <th className="px-5 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentItems.map(app => (
                                        <TableRow key={app.id} app={app} profile={profile} router={router} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-3 mt-6">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all"
                            >
                                <ChevL />
                            </button>
                            <span className="text-sm text-gray-500 font-medium">หน้า {currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all"
                            >
                                <ChevR />
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-20">
                    <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <SearchIcon />
                    </div>
                    <p className="text-gray-700 font-semibold">ไม่พบรายการนัดหมาย</p>
                    <p className="text-sm text-gray-400 mt-1">ลองเปลี่ยนตัวกรองหรือช่วงวันที่</p>
                </div>
            )}
        </div>
    );
}
