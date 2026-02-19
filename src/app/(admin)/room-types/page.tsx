"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { RoomType } from '@/types';

// ── Icons ─────────────────────────────────────────────────────────────────
const PlusIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;
const SearchIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const EditIcon = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const TrashIcon = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const GridIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const ListIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>;
const UsersIcon = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const BedIcon = () => <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;

// ── Status Badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
    const cfg: Record<string, { label: string; dot: string; bg: string; text: string }> = {
        available: { label: 'พร้อมพัก', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
        unavailable: { label: 'ไม่พร้อม', dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-600' },
    };
    const c = cfg[status] || { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${c.bg} ${c.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {c.label}
        </span>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────
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
        const fetch = async () => {
            setLoading(true);
            try {
                const snap = await getDocs(query(collection(db, 'roomTypes'), orderBy('basePrice', 'asc')));
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType));
                setAllRoomTypes(data);
                setFilteredRoomTypes(data);
            } catch { showToast('โหลดข้อมูลล้มเหลว', 'error'); }
            finally { setLoading(false); }
        };
        fetch();
    }, [showToast]);

    useEffect(() => {
        const q = search.toLowerCase();
        setFilteredRoomTypes(allRoomTypes.filter(s =>
            (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)
        ));
    }, [search, allRoomTypes]);

    const handleUpdateStatus = async (rt: RoomType) => {
        const newStatus = rt.status === 'available' ? 'unavailable' : 'available';
        try {
            if (rt.id) {
                await updateDoc(doc(db, 'roomTypes', rt.id), { status: newStatus });
                setAllRoomTypes(prev => prev.map(s => s.id === rt.id ? { ...s, status: newStatus } : s));
                showToast(`เปลี่ยนสถานะเป็น "${newStatus === 'available' ? 'พร้อมพัก' : 'ไม่พร้อม'}" แล้ว`, 'success');
            }
        } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
    };

    const confirmDelete = async () => {
        if (!toDelete?.id) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'roomTypes', toDelete.id));
            setAllRoomTypes(prev => prev.filter(s => s.id !== toDelete.id));
            showToast('ลบข้อมูลสำเร็จ', 'success');
        } catch { showToast('ลบไม่สำเร็จ', 'error'); }
        finally { setIsDeleting(false); setToDelete(null); }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">กำลังโหลด...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <ConfirmationModal
                show={!!toDelete}
                title="ยืนยันการลบ"
                message={`คุณแน่ใจหรือไม่ว่าต้องการลบ "${toDelete?.name}"?`}
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
                isProcessing={isDeleting}
            />

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">ประเภทห้องพัก</h1>
                    <p className="text-xs text-gray-400 mt-0.5">จัดการประเภทห้องพัก ราคา และรายละเอียด</p>
                </div>
                <Link
                    href="/room-types/add"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-all hover:opacity-90 shadow-sm"
                    style={{ backgroundColor: '#1A1A1A' }}
                >
                    <PlusIcon /> เพิ่มประเภทห้อง
                </Link>
            </div>

            {/* ── Search + View Toggle ───────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 mb-5">
                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหาประเภทห้อง..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                    />
                </div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                    {(['grid', 'table'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className="p-2 rounded-lg transition-all"
                            style={viewMode === mode ? { backgroundColor: '#1A1A1A', color: 'white' } : { color: '#9ca3af' }}
                        >
                            {mode === 'grid' ? <GridIcon /> : <ListIcon />}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Count ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-bold text-gray-900">{filteredRoomTypes.length}</span>
                <span className="text-sm text-gray-400">ประเภทห้อง</span>
            </div>

            {/* ── Empty ─────────────────────────────────────────────── */}
            {filteredRoomTypes.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <BedIcon />
                    </div>
                    <p className="text-gray-700 font-bold">ไม่พบประเภทห้องพัก</p>
                    <p className="text-sm text-gray-400 mt-1">ลองเพิ่มประเภทห้องใหม่</p>
                    <Link href="/room-types/add" className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: '#1A1A1A' }}>
                        <PlusIcon /> เพิ่มเลย
                    </Link>
                </div>
            ) : viewMode === 'grid' ? (

                /* ── Grid View ────────────────────────────────────────── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredRoomTypes.map(rt => (
                        <div key={rt.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col group">
                            {/* Image */}
                            <div className="relative h-44 w-full bg-gray-100">
                                {rt.imageUrls?.[0] ? (
                                    <Image src={rt.imageUrls[0]} alt={rt.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                                        <BedIcon />
                                    </div>
                                )}
                                <div className="absolute top-2.5 right-2.5">
                                    <StatusBadge status={rt.status || 'available'} />
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-bold text-gray-900 mb-1">{rt.name}</h3>
                                <p className="text-xs text-gray-400 line-clamp-2 mb-3 flex-1">{rt.description || 'ไม่มีรายละเอียด'}</p>

                                <div className="flex items-center justify-between text-xs mb-3">
                                    <div className="flex items-center gap-1 text-gray-400">
                                        <UsersIcon />
                                        <span>สูงสุด {rt.maxGuests} ท่าน</span>
                                    </div>
                                    <span className="font-bold text-gray-900 text-sm">{rt.basePrice?.toLocaleString()} ฿</span>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                                    <button
                                        onClick={() => handleUpdateStatus(rt)}
                                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors ${rt.status === 'available'
                                                ? 'border-red-200 text-red-500 hover:bg-red-50'
                                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                            }`}
                                    >
                                        {rt.status === 'available' ? 'ปิด' : 'เปิด'}
                                    </button>
                                    <Link
                                        href={`/room-types/edit/${rt.id}`}
                                        className="p-2 text-gray-400 hover:text-blue-600 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all"
                                    >
                                        <EditIcon />
                                    </Link>
                                    <button
                                        onClick={() => setToDelete(rt)}
                                        className="p-2 text-gray-400 hover:text-red-500 border border-gray-100 rounded-xl hover:border-red-200 hover:bg-red-50 transition-all"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (

                /* ── Table View ───────────────────────────────────────── */
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-50">
                                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">ห้องพัก</th>
                                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">ราคา/คืน</th>
                                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">ผู้เข้าพัก</th>
                                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">สถานะ</th>
                                <th className="px-5 py-3.5 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredRoomTypes.map(rt => (
                                <tr key={rt.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                                                {rt.imageUrls?.[0] ? (
                                                    <Image src={rt.imageUrls[0]} alt={rt.name} fill className="object-cover" unoptimized />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">—</div>
                                                )}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-900">{rt.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-sm font-bold text-gray-900">{rt.basePrice?.toLocaleString()} ฿</td>
                                    <td className="px-5 py-4 text-sm text-gray-500">{rt.maxGuests} ท่าน</td>
                                    <td className="px-5 py-4"><StatusBadge status={rt.status || 'available'} /></td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleUpdateStatus(rt)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${rt.status === 'available' ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                                                {rt.status === 'available' ? 'ปิด' : 'เปิด'}
                                            </button>
                                            <Link href={`/room-types/edit/${rt.id}`} className="p-2 text-gray-400 hover:text-blue-600 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all">
                                                <EditIcon />
                                            </Link>
                                            <button onClick={() => setToDelete(rt)} className="p-2 text-gray-400 hover:text-red-500 border border-gray-100 rounded-xl hover:border-red-200 hover:bg-red-50 transition-all">
                                                <TrashIcon />
                                            </button>
                                        </div>
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
