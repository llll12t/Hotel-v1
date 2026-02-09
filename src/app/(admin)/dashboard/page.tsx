"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '@/app/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { cancelAppointmentByAdmin } from '@/app/actions/appointmentActions';
import { format, startOfDay, endOfDay, parseISO, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
// Temporarily using CustomerHeader or a simplified Navbar until AdminNavbar is available if needed.
// But layout provides Navbar.

// Define Types
interface Appointment {
    id: string;
    status: string;
    customerInfo: {
        pictureUrl?: string;
        fullName?: string;
        name?: string;
        phone?: string;
    };
    appointmentInfo: {
        dateTime: any; // Firestore timestamp
        addOns?: { duration: number }[];
    };
    serviceInfo: {
        name: string;
        duration: number;
    };
    paymentInfo: {
        totalPrice: number;
    };
    parsedDate?: Date; // Added for optimization
}

// Helper to safely parse date from various formats
const parseAppointmentDate = (dateInfo: any): Date | null => {
    if (!dateInfo) return null;
    if (typeof dateInfo.toDate === 'function') return dateInfo.toDate();
    if (dateInfo instanceof Date) return dateInfo;
    if (typeof dateInfo === 'string') return new Date(dateInfo);
    if (dateInfo.seconds) return new Date(dateInfo.seconds * 1000); // Handle raw timestamp
    return null;
};

// --- Icons ---
const Icons = {
    Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    ChevronLeft: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    ChevronRight: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
};

// --- Cancel Modal ---
function CancelModal({ appointment, onClose, onConfirm }: { appointment: Appointment, onClose: () => void, onConfirm: (id: string, reason: string) => Promise<void> }) {
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
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">ยืนยันการยกเลิก</h2>
                <p className="text-sm text-gray-600 mb-4">ยกเลิกนัดหมายของ <span className="font-medium">{appointment.customerInfo.name || appointment.customerInfo.fullName}</span>?</p>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล *</label>
                    <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500" placeholder="ระบุเหตุผล..." />
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-md hover:bg-gray-50">ปิด</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400">
                        {isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Status Config ---
const STATUS_CONFIG: Record<string, { label: string, bg: string, text: string }> = {
    awaiting_confirmation: { label: 'รอยืนยัน', bg: 'bg-yellow-100', text: 'text-yellow-800' },
    confirmed: { label: 'ยืนยันแล้ว', bg: 'bg-blue-100', text: 'text-blue-800' },
    in_progress: { label: 'กำลังบริการ', bg: 'bg-purple-100', text: 'text-purple-800' },
    completed: { label: 'เสร็จสิ้น', bg: 'bg-green-100', text: 'text-green-800' },
    cancelled: { label: 'ยกเลิก', bg: 'bg-red-100', text: 'text-red-800' },
    pending: { label: 'จอง', bg: 'bg-gray-100', text: 'text-gray-800' },
};

const TABS = [
    { key: 'upcoming', label: 'กำลังดำเนินการ' },
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'in_progress', label: 'กำลังบริการ' },
    { key: 'confirmed', label: 'ยืนยันแล้ว' },
    { key: 'awaiting_confirmation', label: 'รอยืนยัน' },
    { key: 'completed', label: 'เสร็จสิ้น' },
    { key: 'cancelled', label: 'ยกเลิก' },
];

// --- Stat Card ---
const StatCard = ({ title, value, subValue, color, onClick, active }: any) => (
    <div onClick={onClick} className={`bg-white rounded-lg p-4 cursor-pointer transition-all hover:shadow-sm ${active ? 'ring-2 ring-gray-900' : 'border border-gray-100'}`}>
        <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <div className={`w-2 h-2 rounded-full ${color}`}></div>
        </div>
        <p className="text-xl font-bold text-gray-900 mt-1">{value} <span className="text-xs font-normal text-gray-400">{subValue}</span></p>
    </div>
);

// --- Appointment Card (Compact) ---
const AppointmentCard = ({ appointment, onCancelClick }: { appointment: Appointment, onCancelClick: (app: Appointment) => void }) => {
    const { profile } = useProfile();
    const router = useRouter();
    const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.cancelled;
    const date = appointment.parsedDate || parseAppointmentDate(appointment.appointmentInfo?.dateTime);
    const duration = (appointment.serviceInfo?.duration || 0) + (appointment.appointmentInfo?.addOns || []).reduce((s, a) => s + (a.duration || 0), 0);

    return (
        <div onClick={() => router.push(`/appointments/${appointment.id}`)} className="bg-white border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {appointment.customerInfo?.pictureUrl ? (
                        <img src={appointment.customerInfo.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-medium flex-shrink-0">
                            {(appointment.customerInfo?.name || appointment.customerInfo?.fullName || 'C').charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{appointment.customerInfo?.fullName || appointment.customerInfo?.name}</p>
                        <p className="text-xs text-gray-400 truncate">{appointment.customerInfo?.phone}</p>
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${status.bg} ${status.text} flex-shrink-0`}>{status.label}</span>
            </div>
            <div className="bg-gray-50 rounded p-2 mb-2">
                <p className="text-xs font-medium text-gray-800 truncate">{appointment.serviceInfo?.name}</p>
                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                    <span>{duration} นาที</span>
                    <span className="font-medium text-gray-700">{(appointment.paymentInfo?.totalPrice || 0).toLocaleString()} {profile.currencySymbol}</span>
                </div>
            </div>
            <div className="text-[10px] text-gray-400">
                {date ? format(date, 'd MMM yyyy, HH:mm', { locale: th }) : '-'}
            </div>
        </div>
    );
};

// --- Main Page ---
export default function DashboardPage() {
    // Removed stubbed cancelAppointmentByAdmin

    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [viewMode, setViewMode] = useState('grid');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const { profile, loading: profileLoading } = useProfile();
    const router = useRouter();

    const [filters, setFilters] = useState({
        startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'),
        endDate: format(new Date(new Date().setDate(new Date().getDate() + 30)), 'yyyy-MM-dd'),
        search: '',
    });

    useEffect(() => {
        const q = query(collection(db, 'appointments'), orderBy('appointmentInfo.dateTime', 'desc'));
        const unsub = onSnapshot(q, snap => {
            const apps = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    parsedDate: parseAppointmentDate(data.appointmentInfo?.dateTime)
                } as Appointment;
            });
            setAllAppointments(apps);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const filteredAppointments = useMemo(() => {
        const start = startOfDay(parseISO(filters.startDate));
        const end = endOfDay(parseISO(filters.endDate));
        const search = filters.search.toLowerCase();
        return allAppointments.filter(app => {
            const date = app.parsedDate;
            if (!date || date < start || date > end) return false;

            const fullName = app.customerInfo?.fullName || app.customerInfo?.name || '';
            const phone = app.customerInfo?.phone || '';

            if (search && !fullName.toLowerCase().includes(search) && !phone.includes(search)) return false;
            return true;
        });
    }, [allAppointments, filters]);

    const stats = useMemo(() => {
        const today = new Date();
        const todayApps = allAppointments.filter(a => {
            const date = a.parsedDate;
            return date ? isSameDay(date, today) : false;
        });
        const pending = allAppointments.filter(a => a.status === 'awaiting_confirmation');
        const revenue = filteredAppointments.reduce((sum, a) => sum + (a.status !== 'cancelled' ? (a.paymentInfo?.totalPrice || 0) : 0), 0);
        return { todayCount: todayApps.length, pendingCount: pending.length, totalRevenue: revenue, totalFiltered: filteredAppointments.length };
    }, [allAppointments, filteredAppointments]);

    const tabAppointments = filteredAppointments.filter(a => {
        if (activeTab === 'all') return true;
        if (activeTab === 'upcoming') return ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'].includes(a.status);
        return a.status === activeTab;
    });
    const totalPages = Math.ceil(tabAppointments.length / itemsPerPage);
    const currentItems = tabAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => setCurrentPage(1), [activeTab, filters]);

    const navigateToDetail = (id: string) => {
        router.push(`/appointments/${id}`);
    };

    if (loading || profileLoading) return (
        <div className="flex justify-center items-center min-h-[400px]">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-6">
            {appointmentToCancel && <CancelModal appointment={appointmentToCancel} onClose={() => setAppointmentToCancel(null)} onConfirm={async (id, reason) => {
                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    alert('Unauthorized');
                    return;
                }
                const res = await cancelAppointmentByAdmin(id, reason, { adminToken: token });
                alert(res.success ? 'ยกเลิกสำเร็จ' : res.error);
            }} />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">ภาพรวมการนัดหมาย</h1>
                    <p className="text-sm text-gray-500">จัดการการจองและดูสถิติ</p>
                </div>
                <div className="flex items-center gap-1 bg-white border rounded-md p-1">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.Grid /></button>
                    <button onClick={() => setViewMode('table')} className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.List /></button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <StatCard title="วันนี้" value={stats.todayCount} subValue="รายการ" color="bg-blue-500"
                    onClick={() => { setFilters(p => ({ ...p, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') })); setActiveTab('all'); }}
                    active={isSameDay(parseISO(filters.startDate), new Date()) && isSameDay(parseISO(filters.endDate), new Date())} />
                <StatCard title="รอยืนยัน" value={stats.pendingCount} subValue="รายการ" color="bg-yellow-500"
                    onClick={() => setActiveTab('awaiting_confirmation')} active={activeTab === 'awaiting_confirmation'} />
                <StatCard title="รายได้" value={`${stats.totalRevenue.toLocaleString()}`} subValue={profile.currencySymbol} color="bg-green-500" />
                <StatCard title="ทั้งหมด" value={stats.totalFiltered} subValue="รายการ" color="bg-gray-400"
                    onClick={() => setActiveTab('all')} active={activeTab === 'all'} />
            </div>

            {/* Filters & Tabs */}
            <div className="bg-white border border-gray-100 rounded-lg p-4 mb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Tabs */}
                    <div className="flex flex-wrap gap-1">
                        {TABS.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${activeTab === tab.key ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                                {tab.label}
                                <span className={`ml-1 px-1 rounded text-[10px] ${activeTab === tab.key ? 'bg-white/20' : 'bg-gray-200'}`}>
                                    {tab.key === 'all' ? filteredAppointments.length :
                                        tab.key === 'upcoming' ? filteredAppointments.filter(a => ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'].includes(a.status)).length :
                                            filteredAppointments.filter(a => a.status === tab.key).length}
                                </span>
                            </button>
                        ))}
                    </div>
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1.5 rounded border text-xs">
                            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="bg-transparent text-gray-900 outline-none w-24" />
                            <span className="text-gray-300">-</span>
                            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="bg-transparent text-gray-900 outline-none w-24" />
                        </div>
                        <input type="text" name="search" placeholder="ค้นหา..." value={filters.search} onChange={handleFilterChange}
                            className="px-3 py-1.5 w-full sm:w-40 border rounded text-xs text-gray-900 focus:ring-1 focus:ring-gray-900" />
                    </div>
                </div>
            </div>

            {/* Content */}
            {currentItems.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {currentItems.map(app => <AppointmentCard key={app.id} appointment={app} onCancelClick={setAppointmentToCancel} />)}
                        </div>
                    ) : (
                        <div className="bg-white border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">บริการ</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ราคา</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {currentItems.map(app => {
                                        const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.cancelled;
                                        const date = app.parsedDate;
                                        return (
                                            <tr key={app.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {app.customerInfo?.pictureUrl ? (
                                                            <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={app.customerInfo.pictureUrl} alt="Customer" className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-xs">
                                                                {(app.customerInfo?.name || app.customerInfo?.fullName || 'C').charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">{app.customerInfo?.fullName || app.customerInfo?.name}</div>
                                                            <div className="text-xs text-gray-500">{app.customerInfo?.phone}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{app.serviceInfo?.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {date ? format(date, 'd MMM HH:mm', { locale: th }) : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{(app.paymentInfo?.totalPrice || 0).toLocaleString()} {profile.currencySymbol}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.text}`}>{status.label}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => navigateToDetail(app.id)} className="text-blue-600 hover:underline text-sm">ดู</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-6">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-30"><Icons.ChevronLeft /></button>
                            <span className="text-sm text-gray-600">หน้า {currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-30"><Icons.ChevronRight /></button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.Search /></div>
                    <p className="text-gray-600 font-medium">ไม่พบรายการนัดหมาย</p>
                    <p className="text-sm text-gray-400 mt-1">ลองเปลี่ยนตัวกรอง</p>
                </div>
            )}
        </div>
    );
}
