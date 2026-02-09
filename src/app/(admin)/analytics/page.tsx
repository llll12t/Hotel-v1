"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, subDays, differenceInDays, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types'; // Import types if available

// --- Icons ---
const Icons = {
    TrendingUp: () => <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    TrendingDown: () => <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
    Calendar: () => <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Dollar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    CheckCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Star: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    Gift: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
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
    <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <div className={`p-2 rounded-md ${iconBg}`}><Icon /></div>
        </div>
        <h3 className="text-2xl font-semibold text-gray-900">{value}</h3>
        {subtext && (
            <div className="flex items-center mt-1 gap-2">
                {trend !== undefined && (
                    <span className={`flex items-center text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
    <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="w-full h-[300px]">
            <ResponsiveContainer>{children as any}</ResponsiveContainer>
        </div>
    </div>
);

// --- Main Page ---
export default function AnalyticsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [rewards, setRewards] = useState<any[]>([]);
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
                const [appSnap, revSnap, rewSnap] = await Promise.all([
                    getDocs(query(collection(db, 'appointments'), orderBy('createdAt', 'desc'))),
                    getDocs(query(collection(db, 'reviews'))),
                    getDocs(query(collection(db, 'rewards')))
                ]);
                setAppointments(appSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setReviews(revSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setRewards(rewSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) { console.error("Error fetching data: ", err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const analytics = useMemo(() => {
        if (loading) return null;

        const daysDiff = differenceInDays(dateRange.end, dateRange.start) + 1;
        const prevStart = subDays(dateRange.start, daysDiff);
        const prevEnd = subDays(dateRange.end, daysDiff);

        const filterByDate = (data: any[], start: Date, end: Date) => data.filter(item => {
            // Handle Firestore Timestamp or Date object
            const d = item.createdAt?.toDate ? item.createdAt.toDate() : (item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt));
            return d >= start && d <= end;
        });

        const currentApps = filterByDate(appointments, dateRange.start, dateRange.end);
        const prevApps = filterByDate(appointments, prevStart, prevEnd);

        const calcRevenue = (apps: any[]) => apps.filter(a => a.status === 'completed').reduce((sum, a) => sum + (Number(a.paymentInfo?.totalPrice) || Number(a.paymentInfo?.amountPaid) || 0), 0);

        const currentRevenue = calcRevenue(currentApps);
        const prevRevenue = calcRevenue(prevApps);
        const revenueGrowth = prevRevenue ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        const currentCompleted = currentApps.filter(a => a.status === 'completed').length;
        const prevCompleted = prevApps.filter(a => a.status === 'completed').length;
        const completedGrowth = prevCompleted ? ((currentCompleted - prevCompleted) / prevCompleted) * 100 : 0;

        const dailyData = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map(day => {
            const dayApps = currentApps.filter(a => isSameDay(a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)), day));
            const revenue = dayApps.filter(a => a.status === 'completed').reduce((sum, a) => sum + (Number(a.paymentInfo?.totalPrice) || Number(a.paymentInfo?.amountPaid) || 0), 0);
            const discount = dayApps.filter(a => a.status === 'completed').reduce((sum, a) => sum + (Number(a.paymentInfo?.discount) || 0), 0);
            return { date: format(day, 'dd/MM'), revenue, discount, completed: dayApps.filter(a => a.status === 'completed').length };
        });

        const serviceStats: any = {};
        currentApps.filter(a => a.status === 'completed').forEach(a => {
            const name = a.serviceInfo?.name || a.serviceName || 'Unknown';
            if (!serviceStats[name]) serviceStats[name] = { count: 0, revenue: 0 };
            serviceStats[name].count++;
            serviceStats[name].revenue += (Number(a.paymentInfo?.totalPrice) || 0);
        });
        const topServices = Object.entries(serviceStats).map(([name, stats]: [string, any]) => ({ name, ...stats })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);

        const techStats: any = {};
        currentApps.filter(a => a.status === 'completed').forEach(a => {
            let name = 'ไม่ระบุช่าง';
            if (a.technicianId && a.technicianId !== 'auto-assign') {
                name = a.technicianInfo?.firstName ? `${a.technicianInfo.firstName} ${a.technicianInfo.lastName || ''}`.trim() : 'ไม่ระบุช่าง';
            }
            if (!techStats[name]) techStats[name] = 0;
            techStats[name]++;
        });
        const topTechnicians = Object.entries(techStats).map(([name, count]: [string, any]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

        const currentReviews = filterByDate(reviews, dateRange.start, dateRange.end);
        const avgRating = currentReviews.length ? (currentReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / currentReviews.length).toFixed(1) : 0;

        const totalRedeemed = rewards.reduce((sum, r) => sum + (r.redeemedCount || 0), 0);
        const rewardDiscountStats: any = {};
        currentApps.forEach(app => {
            if (app.status === 'completed' && app.paymentInfo?.couponName && app.paymentInfo?.discount) {
                const name = app.paymentInfo.couponName;
                if (!rewardDiscountStats[name]) rewardDiscountStats[name] = 0;
                rewardDiscountStats[name] += (Number(app.paymentInfo.discount) || 0);
            }
        });
        const topRewards = rewards.map(r => ({ ...r, count: r.redeemedCount || 0, totalDiscounted: rewardDiscountStats[r.name] || 0 })).sort((a, b) => b.count - a.count).slice(0, 5);

        return { totalRevenue: currentRevenue, revenueGrowth: Math.round(revenueGrowth), totalAppointments: currentApps.length, completedAppointments: currentCompleted, completedGrowth: Math.round(completedGrowth), avgRating, reviewCount: currentReviews.length, dailyData, topServices, topTechnicians, totalRedeemed, topRewards };
    }, [loading, appointments, reviews, rewards, dateRange]);

    const exportToCSV = () => {
        if (!analytics) return;
        const headers = ['Date', 'Service', 'Customer', 'Technician', 'Price', 'Status'];
        const rows = appointments.filter(a => {
            const d = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt));
            return d >= dateRange.start && d <= dateRange.end;
        }).map(a => [
            format(a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)), 'yyyy-MM-dd HH:mm'),
            `"${a.serviceInfo?.name || a.serviceName || ''}"`,
            `"${a.customerInfo?.fullName || a.customerInfo?.name || ''}"`,
            `"${a.technicianInfo?.firstName || ''} ${a.technicianInfo?.lastName || ''}"`,
            a.paymentInfo?.totalPrice || 0,
            a.status
        ].join(','));
        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `analytics_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (value) setDateRange(prev => ({ ...prev, [name]: parseISO(value) }));
    };

    if (loading || profileLoading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;
    if (!analytics) return <div className="text-center mt-20 text-gray-500">ไม่มีข้อมูล</div>;

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">ภาพรวมธุรกิจ</h1>
                    <p className="text-sm text-gray-500">วิเคราะห์ประสิทธิภาพและแนวโน้มของร้าน</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg p-2">
                    <div className="flex items-center gap-2 px-2">
                        <Icons.Calendar />
                        <input type="date" name="start" value={format(dateRange.start, 'yyyy-MM-dd')} onChange={handleDateChange} className="text-sm border-none focus:ring-0 text-gray-600 bg-transparent outline-none" />
                        <span className="text-gray-400">-</span>
                        <input type="date" name="end" value={format(dateRange.end, 'yyyy-MM-dd')} onChange={handleDateChange} className="text-sm border-none focus:ring-0 text-gray-600 bg-transparent outline-none" />
                    </div>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <button onClick={exportToCSV} className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                        <Icons.Download /> Export
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <StatCard title="รายได้รวม" value={`${analytics.totalRevenue.toLocaleString()} ${profile?.currencySymbol || '฿'}`} trend={analytics.revenueGrowth} subtext="เทียบกับช่วงก่อนหน้า" icon={Icons.Dollar} iconBg="bg-blue-100 text-blue-600" />
                <StatCard title="งานที่สำเร็จ" value={analytics.completedAppointments} trend={analytics.completedGrowth} subtext="งานที่เสร็จสิ้น" icon={Icons.CheckCircle} iconBg="bg-green-100 text-green-600" />
                <StatCard title="ลูกค้าทั้งหมด" value={analytics.totalAppointments} subtext="รวมทุกสถานะ" icon={Icons.Users} iconBg="bg-purple-100 text-purple-600" />
                <StatCard title="ความพึงพอใจ" value={analytics.avgRating} subtext={`${analytics.reviewCount} รีวิว`} icon={Icons.Star} iconBg="bg-yellow-100 text-yellow-600" />
                <StatCard title="แลกคูปอง" value={analytics.totalRedeemed || 0} subtext="ครั้ง (สะสม)" icon={Icons.Gift} iconBg="bg-pink-100 text-pink-600" />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2">
                    <ChartCard title="แนวโน้มรายได้และส่วนลด">
                        <LineChart data={analytics.dailyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: 'none' }} formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} ${profile.currencySymbol}`, name === 'revenue' ? 'รายได้' : 'ส่วนลด']} />
                            <Legend />
                            <Line type="monotone" dataKey="revenue" name="รายได้" stroke="#3B82F6" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="discount" name="ส่วนลด" stroke="#EC4899" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ChartCard>
                </div>
                <div>
                    <ChartCard title="สัดส่วนบริการ">
                        <PieChart>
                            <Pie data={analytics.topServices} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3}>
                                {analytics.topServices.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <RechartsTooltip />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ChartCard>
                </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    {/* Top Technicians */}
                    <div className="bg-white border border-gray-200 rounded-lg p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">ช่างยอดนิยม</h3>
                        <div className="space-y-2">
                            {analytics.topTechnicians.map((tech: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-sm">{idx + 1}</div>
                                        <span className="text-sm text-gray-700">{tech.name}</span>
                                    </div>
                                    <span className="font-medium text-gray-900 text-sm">{tech.count} งาน</span>
                                </div>
                            ))}
                            {analytics.topTechnicians.length === 0 && <p className="text-gray-400 text-center py-4 text-sm">ไม่มีข้อมูลช่าง</p>}
                        </div>
                    </div>

                    {/* Top Rewards */}
                    <div className="bg-white border border-gray-200 rounded-lg p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">ของรางวัลยอดฮิต</h3>
                        <div className="space-y-2">
                            {analytics.topRewards.map((reward: any, idx: number) => (
                                <div key={idx} className="p-3 bg-pink-50 rounded-md">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-medium text-sm">{idx + 1}</div>
                                            <span className="text-sm text-gray-700">{reward.name}</span>
                                        </div>
                                        <span className="font-medium text-gray-900 text-sm">แลก {reward.count} ครั้ง</span>
                                    </div>
                                    <div className="flex justify-between items-center pl-10 text-xs text-gray-500">
                                        <span>ลดไปแล้ว</span>
                                        <span className="font-medium text-pink-600">{Number(reward.totalDiscounted).toLocaleString()} {profile.currencySymbol}</span>
                                    </div>
                                </div>
                            ))}
                            {analytics.topRewards.every(r => r.count === 0) && <p className="text-gray-400 text-center py-4 text-sm">ยังไม่มีการแลกของรางวัล</p>}
                        </div>
                    </div>
                </div>

                {/* Service Performance Table */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">ประสิทธิภาพบริการ</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">บริการ</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">รายได้</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {analytics.topServices.map((service: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{service.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{service.count}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-blue-600 text-right">{service.revenue.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
