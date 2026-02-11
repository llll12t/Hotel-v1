"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, subDays, differenceInDays, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';

// --- Icons ---
const Icons = {
    TrendingUp: () => <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    TrendingDown: () => <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
    Calendar: () => <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Dollar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Bed: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, // Home/Room icon equivalent
    Key: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
    Clock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    CheckCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

// --- Helper Components ---
interface StatCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    trend?: number;
    icon: React.FC<any>;
    iconBg: string;
}

const StatCard = ({ title, value, subtext, trend, icon: Icon, iconBg }: StatCardProps) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <div className={`p-2 rounded-md ${iconBg}`}><Icon /></div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {subtext && (
            <div className="flex items-center mt-2 gap-2">
                {trend !== undefined && (
                    <span className={`flex items-center text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'} bg-opacity-10 px-1.5 py-0.5 rounded`}>
                        {trend >= 0 ? <Icons.TrendingUp /> : <Icons.TrendingDown />}
                        <span className="ml-1">{Math.abs(trend)}%</span>
                    </span>
                )}
                <p className="text-xs text-gray-400">{subtext}</p>
            </div>
        )}
    </div>
);

const ChartCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-6">{title}</h3>
        <div className="w-full h-[320px]">
            <ResponsiveContainer>{children as any}</ResponsiveContainer>
        </div>
    </div>
);

// --- Main Page ---
export default function AnalyticsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();
    const [dateRange, setDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Appointments (Rooms only ideally, but easier to filter later)
                const appQuery = query(collection(db, 'appointments'), where('bookingType', '==', 'room'));
                const roomQuery = query(collection(db, 'rooms'));

                const [appSnap, roomSnap] = await Promise.all([
                    getDocs(appQuery),
                    getDocs(roomQuery)
                ]);

                // Sort appointments by createdAt client-side to avoid compound index requirement for now
                const apps = appSnap.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                        // Normalize dates for calculation
                        checkIn: data.bookingInfo?.checkInDate ? parseISO(data.bookingInfo.checkInDate) : null,
                        checkOut: data.bookingInfo?.checkOutDate ? parseISO(data.bookingInfo.checkOutDate) : null
                    };
                }).sort((a: any, b: any) => b.createdAt - a.createdAt);

                setAppointments(apps);
                setRooms(roomSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) { console.error("Error fetching data: ", err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const analytics = useMemo(() => {
        if (loading || rooms.length === 0) return null;

        // Filter appointments that overlap with the selected Date Range
        // An appointment overlaps if: checkIn <= rangeEnd AND checkOut >= rangeStart
        const filterByOverlap = (apps: any[], start: Date, end: Date) => apps.filter(app => {
            if (!app.checkIn || !app.checkOut) return false;
            // Valid confirmed/completed/in_progress bookings only
            if (['cancelled', 'declined', 'failed'].includes(app.status)) return false;

            return app.checkIn <= end && app.checkOut >= start;
        });

        const currentApps = filterByOverlap(appointments, dateRange.start, dateRange.end);

        // Calculate Total Revenue from Room Bookings in this period
        // Simple logic: If booking is FULLY within range, count full price. 
        // If partially, we ideally prorate, but for simplicity let's count Total Price of bookings *Active* in this period
        // OR better: Count payment date? 
        // Let's stick to standard: Revenue based on Stay Date (Accrual basis) or Booking Date.
        // Let's use: Revenue from bookings that have stay dates in this range. 
        const totalRevenue = currentApps.reduce((sum, app) => sum + (Number(app.paymentInfo?.totalPrice) || 0), 0);

        // Occupancy Rate Calculation
        const totalDays = differenceInDays(dateRange.end, dateRange.start) + 1;
        const totalRoomNightsAvailable = rooms.length * totalDays;

        let bookedRoomNights = 0;
        const dailyData = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map(day => {
            // Count rooms occupied on this 'day'
            const occupied = currentApps.filter(app => {
                // Check if 'day' is within checkIn (inclusive) and checkOut (exclusive) - Standard hotel logic
                // Typically Check-out day is not an "occupied night"
                if (!app.checkIn || !app.checkOut) return false;
                return day >= app.checkIn && day < app.checkOut;
            }).length;

            bookedRoomNights += occupied;

            const revenueForDay = currentApps.filter(app => {
                // Simple revenue attribution: distribute strictly? No, let's just sum payments collected on this day?
                // Or sum total price of bookings created this day?
                // Let's go with: Revenue = Sum of TotalPrice of bookings checked-in on this day (Front-desk style)
                return isSameDay(app.checkIn, day);
            }).reduce((sum, app) => sum + (Number(app.paymentInfo?.totalPrice) || 0), 0);

            return {
                date: format(day, 'dd/MM'),
                occupancy: occupied,
                revenue: revenueForDay,
                occupancyRate: (occupied / rooms.length) * 100
            };
        });

        const occupancyRate = totalRoomNightsAvailable > 0 ? (bookedRoomNights / totalRoomNightsAvailable) * 100 : 0;

        // Room Type Performance
        const roomTypeStats: any = {};
        currentApps.forEach(app => {
            const typeName = app.roomTypeInfo?.name || app.bookingInfo?.roomType || 'Unknown';
            if (!roomTypeStats[typeName]) roomTypeStats[typeName] = { count: 0, revenue: 0, nights: 0 };
            roomTypeStats[typeName].count++;
            roomTypeStats[typeName].revenue += (Number(app.paymentInfo?.totalPrice) || 0);
            roomTypeStats[typeName].nights += (app.bookingInfo?.nights || 1);
        });
        const topRoomTypes = Object.entries(roomTypeStats)
            .map(([name, stats]: [string, any]) => ({ name, ...stats }))
            .sort((a: any, b: any) => b.revenue - a.revenue);

        // Booking Status
        const statusCounts: any = {};
        currentApps.forEach(app => {
            const s = app.status;
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });
        const statusData = Object.entries(statusCounts).map(([status, count]) => ({
            name: status,
            value: count
        }));

        // Calculate Trend (Previous Period)
        const prevStart = subDays(dateRange.start, totalDays);
        const prevEnd = subDays(dateRange.end, totalDays);
        const prevApps = filterByOverlap(appointments, prevStart, prevEnd);
        const prevRevenue = prevApps.reduce((sum, app) => sum + (Number(app.paymentInfo?.totalPrice) || 0), 0);
        const revenueGrowth = prevRevenue ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        return {
            totalRevenue,
            revenueGrowth: Math.round(revenueGrowth),
            occupancyRate: Math.round(occupancyRate),
            totalBookings: currentApps.length,
            dailyData,
            topRoomTypes,
            statusData,
            activeGuests: currentApps.filter(a => a.status === 'in_progress').reduce((sum, a) => sum + (Number(a.bookingInfo?.guests) || 1), 0)
        };
    }, [loading, appointments, rooms, dateRange]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (value) setDateRange(prev => ({ ...prev, [name]: parseISO(value) }));
    };

    if (loading || profileLoading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;
    if (!analytics) return <div className="text-center mt-20 text-gray-500">กำลังโหลดข้อมูล...</div>;

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">วิเคราะห์ข้อมูลห้องพัก</h1>
                    <p className="text-sm text-gray-500">ภาพรวมประสิทธิภาพการบริหารจัดการห้องพัก</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm">
                    <div className="flex items-center gap-2 px-3 py-1">
                        <Icons.Calendar />
                        <input type="date" name="start" value={format(dateRange.start, 'yyyy-MM-dd')} onChange={handleDateChange} className="text-sm border-none focus:ring-0 text-gray-600 bg-transparent outline-none font-medium" />
                        <span className="text-gray-400">ถึง</span>
                        <input type="date" name="end" value={format(dateRange.end, 'yyyy-MM-dd')} onChange={handleDateChange} className="text-sm border-none focus:ring-0 text-gray-600 bg-transparent outline-none font-medium" />
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="รายได้รวม (ช่วงที่เลือก)"
                    value={`${analytics.totalRevenue.toLocaleString()} ${profile?.currencySymbol || '฿'}`}
                    trend={analytics.revenueGrowth}
                    subtext="เทียบกับช่วงก่อนหน้า"
                    icon={Icons.Dollar}
                    iconBg="bg-blue-100 text-blue-600"
                />
                <StatCard
                    title="อัตราการเข้าพัก (Occupancy)"
                    value={`${analytics.occupancyRate}%`}
                    subtext={`จากห้องพักทั้งหมด ${rooms.length} ห้อง`}
                    icon={Icons.Key}
                    iconBg="bg-indigo-100 text-indigo-600"
                />
                <StatCard
                    title="การจองทั้งหมด"
                    value={analytics.totalBookings}
                    subtext="รายการ"
                    icon={Icons.Bed}
                    iconBg="bg-purple-100 text-purple-600"
                />
                <StatCard
                    title="ผู้เข้าพักปัจจุบัน (Active)"
                    value={analytics.activeGuests}
                    subtext="คน"
                    icon={Icons.CheckCircle}
                    iconBg="bg-green-100 text-green-600"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ChartCard title="แนวโน้มอัตราการเข้าพักรายวัน">
                        <AreaChart data={analytics.dailyData}>
                            <defs>
                                <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} unit="%" />
                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                            <Area type="monotone" dataKey="occupancyRate" name="Occupancy Rate (%)" stroke="#3B82F6" fillOpacity={1} fill="url(#colorOccupancy)" />
                        </AreaChart>
                    </ChartCard>
                </div>
                <div>
                    <ChartCard title="สัดส่วนรายได้ตามประเภทห้อง">
                        {analytics.topRoomTypes.length > 0 ? (
                            <PieChart>
                                <Pie
                                    data={analytics.topRoomTypes}
                                    dataKey="revenue"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                >
                                    {analytics.topRoomTypes.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip formatter={(value: any) => `${Number(value).toLocaleString()} ${profile?.currencySymbol || '฿'}`} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
                        )}
                    </ChartCard>
                </div>
            </div>

            {/* Detailed Stats Table */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 mb-4">ประสิทธิภาพรายประเภทห้องพัก</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภทห้อง</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวนการจอง</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวนคืนรวม</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">รายได้รวม</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {analytics.topRoomTypes.map((type: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{type.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{type.count}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{type.nights}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">{type.revenue.toLocaleString()}</td>
                                </tr>
                            ))}
                            {analytics.topRoomTypes.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">ไม่มีข้อมูลในช่วงเวลานี้</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
