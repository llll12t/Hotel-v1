"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { RoomType } from '@/types';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Tag: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
    Users: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
};

const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { label: string, bg: string, text: string }> = {
        available: { label: 'พร้อมพัก', bg: 'bg-green-100', text: 'text-green-800' },
        unavailable: { label: 'ไม่พร้อม', bg: 'bg-red-100', text: 'text-red-800' },
    };
    const current = config[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${current.bg} ${current.text}`}>{current.label}</span>;
};

export default function RoomTypesListPage() {
    const [allRoomTypes, setAllRoomTypes] = useState<RoomType[]>([]);
    const [filteredRoomTypes, setFilteredRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [toDelete, setToDelete] = useState<RoomType | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchRoomTypes = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'roomTypes'), orderBy('basePrice', 'asc')); // Order by price
                const snap = await getDocs(q);
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomType));
                setAllRoomTypes(data);
                setFilteredRoomTypes(data);
            } catch (e) {
                console.error(e);
                showToast("ไม่สามารถโหลดข้อมูลประเภทห้องพักได้", "error");
            }
            finally { setLoading(false); }
        };
        fetchRoomTypes();
    }, [showToast]);

    useEffect(() => {
        const lowerSearch = search.toLowerCase();
        setFilteredRoomTypes(allRoomTypes.filter(s =>
            (s.name || '').toLowerCase().includes(lowerSearch) ||
            (s.description || '').toLowerCase().includes(lowerSearch)
        ));
    }, [search, allRoomTypes]);

    const handleUpdateStatus = async (rt: RoomType) => {
        const newStatus = rt.status === 'available' ? 'unavailable' : 'available';
        try {
            if (rt.id) {
                await updateDoc(doc(db, 'roomTypes', rt.id), { status: newStatus });
                setAllRoomTypes(prev => prev.map(s => s.id === rt.id ? { ...s, status: newStatus } : s));
                showToast(`อัพเดทสถานะเป็น "${newStatus === 'available' ? 'พร้อมพัก' : 'ไม่พร้อม'}" แล้ว`, 'success');
            }
        } catch { showToast('เกิดข้อผิดพลาดในการอัพเดทสถานะ', 'error'); }
    };

    const confirmDelete = async () => {
        if (!toDelete?.id) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'roomTypes', toDelete.id));
            setAllRoomTypes(prev => prev.filter(s => s.id !== toDelete.id));
            showToast('ลบข้อมูลสำเร็จ!', 'success');
        } catch { showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error'); }
        finally { setIsDeleting(false); setToDelete(null); }
    };

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ConfirmationModal show={!!toDelete} title="ยืนยันการลบ" message={`คุณแน่ใจหรือไม่ว่าต้องการลบ "${toDelete?.name}"?`} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} isProcessing={isDeleting} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">ประเภทห้องพัก</h1>
                    <p className="text-sm text-gray-500">จัดการประเภทห้องพัก ราคา และรายละเอียด</p>
                </div>
                <Link href="/room-types/add" className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors">
                    <Icons.Plus /> เพิ่มประเภทห้อง
                </Link>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <div className="relative w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
                    <input type="text" placeholder="ค้นหาประเภทห้อง..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-500" />
                </div>
                <div className="flex items-center gap-1 bg-white border rounded-md p-1">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.Grid /></button>
                    <button onClick={() => setViewMode('table')} className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.List /></button>
                </div>
            </div>

            {filteredRoomTypes.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.Tag /></div>
                    <p className="text-gray-600 font-medium">ไม่พบข้อมูลประเภทห้องพัก</p>
                    <p className="text-sm text-gray-400 mt-1">ลองเพิ่มประเภทห้องใหม่</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredRoomTypes.map(rt => (
                        <div key={rt.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                            <div className="relative h-48 w-full bg-gray-200">
                                <Image src={rt.imageUrls?.[0] || '/placeholder.png'} alt={rt.name} fill className="object-cover" unoptimized />
                                <div className="absolute top-2 right-2"><StatusBadge status={rt.status || 'available'} /></div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-bold text-gray-900 mb-1">{rt.name}</h3>
                                <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">{rt.description || 'ไม่มีรายละเอียด'}</p>
                                <div className="flex items-center justify-between text-sm mb-3">
                                    <div className="flex items-center gap-1 text-gray-500">
                                        <Icons.Users />
                                        <span>สูงสุด {rt.maxGuests} ท่าน</span>
                                    </div>
                                    <span className="font-bold text-gray-900">{rt.basePrice?.toLocaleString()} ฿</span>
                                </div>
                                <div className="flex items-center gap-2 pt-3 border-t">
                                    <button onClick={() => handleUpdateStatus(rt)} className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${rt.status === 'available' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                                        {rt.status === 'available' ? 'ปิด' : 'เปิด'}
                                    </button>
                                    <Link href={`/room-types/edit/${rt.id}`} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border"><Icons.Edit /></Link>
                                    <button onClick={() => setToDelete(rt)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md border"><Icons.Trash /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภทห้อง</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ราคาเริ่มต้น</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้เข้าพักสูงสุด</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredRoomTypes.map(rt => (
                                <tr key={rt.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 rounded-md overflow-hidden bg-gray-100">
                                                <Image src={rt.imageUrls?.[0] || '/placeholder.png'} alt={rt.name} fill className="object-cover" unoptimized />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{rt.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{rt.basePrice?.toLocaleString()} ฿</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{rt.maxGuests} ท่าน</td>
                                    <td className="px-6 py-4"><StatusBadge status={rt.status || 'available'} /></td>
                                    <td className="px-6 py-4 text-right">
                                        <Link href={`/room-types/edit/${rt.id}`} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</Link>
                                        <button onClick={() => setToDelete(rt)} className="text-red-600 hover:underline text-sm">ลบ</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
