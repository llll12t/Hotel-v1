"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { Room, RoomType } from '@/types';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Home: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
};

const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { label: string, bg: string, text: string }> = {
        available: { label: 'ว่าง', bg: 'bg-green-100', text: 'text-green-800' },
        occupied: { label: 'มีแขก', bg: 'bg-blue-100', text: 'text-blue-800' },
        maintenance: { label: 'ซ่อมบำรุง', bg: 'bg-red-100', text: 'text-red-800' },
        cleaning: { label: 'ทำความสะอาด', bg: 'bg-yellow-100', text: 'text-yellow-800' },
    };
    const current = config[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${current.bg} ${current.text}`}>{current.label}</span>;
};

// --- Modal ---
function RoomFormModal({ open, onClose, onSave, room, roomTypes }: { open: boolean, onClose: () => void, onSave: () => void, room: Room | null, roomTypes: RoomType[] }) {
    const [formData, setFormData] = useState<Partial<Room>>({ number: '', roomTypeId: '', floor: '', status: 'available' });
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const isEdit = !!room;

    useEffect(() => {
        if (room) {
            setFormData({
                number: room.number || '',
                roomTypeId: room.roomTypeId || '',
                floor: room.floor || '',
                status: room.status || 'available',
                notes: room.notes || ''
            });
        } else {
            setFormData({ number: '', roomTypeId: roomTypes[0]?.id || '', floor: '', status: 'available' });
        }
    }, [room, open, roomTypes]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.number || !formData.roomTypeId) return showToast("กรุณากรอกข้อมูลให้ครบ", "error");

        setSaving(true);
        try {
            const roomTypeName = roomTypes.find(rt => rt.id === formData.roomTypeId)?.name || '';
            const dataToSave = { ...formData, roomTypeName };

            if (isEdit && room?.id) {
                await updateDoc(doc(db, "rooms", room.id), dataToSave);
                showToast("อัปเดตห้องพักสำเร็จ!", "success");
            } else {
                await addDoc(collection(db, "rooms"), { ...dataToSave, createdAt: serverTimestamp() });
                showToast("เพิ่มห้องพักสำเร็จ!", "success");
            }
            onSave();
            onClose();
        } catch (error: any) {
            showToast("Error: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">{isEdit ? 'แก้ไขห้องพัก' : 'เพิ่มห้องพัก'}</h2>
                    <button onClick={onClose}><Icons.X /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">หมายเลขห้อง</label>
                        <input type="text" name="number" value={formData.number} onChange={handleChange} className="w-full border rounded p-2" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">ประเภทห้อง</label>
                        <select name="roomTypeId" value={formData.roomTypeId} onChange={handleChange} className="w-full border rounded p-2">
                            <option value="">-- เลือกประเภท --</option>
                            {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">ชั้น / อาคาร</label>
                        <input type="text" name="floor" value={formData.floor} onChange={handleChange} className="w-full border rounded p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">สถานะ</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full border rounded p-2">
                            <option value="available">ว่าง</option>
                            <option value="occupied">มีแขก</option>
                            <option value="cleaning">ทำความสะอาด</option>
                            <option value="maintenance">ซ่อมบำรุง</option>
                        </select>
                    </div>
                    <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function RoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [toDelete, setToDelete] = useState<Room | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const { showToast } = useToast();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rSnap, rtSnap] = await Promise.all([
                getDocs(query(collection(db, 'rooms'), orderBy('number'))),
                getDocs(query(collection(db, 'roomTypes'), orderBy('basePrice')))
            ]);
            setRooms(rSnap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
            setRoomTypes(rtSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoomType)));
        } catch { showToast('Load failed', 'error'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const confirmDelete = async () => {
        if (!toDelete) return;
        try {
            await deleteDoc(doc(db, "rooms", toDelete.id));
            setRooms(prev => prev.filter(r => r.id !== toDelete.id));
            showToast("Deleted", "success");
        } catch { showToast("Failed to delete", "error"); }
        setToDelete(null);
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ConfirmationModal show={!!toDelete} title="Confirm Delete" message="Delete this room?" onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
            <RoomFormModal open={showModal} onClose={() => setShowModal(false)} onSave={fetchData} room={editingRoom} roomTypes={roomTypes} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">จัดการห้องพัก</h1>
                    <p className="text-gray-500">Rooms Management</p>
                </div>
                <button onClick={() => { setEditingRoom(null); setShowModal(true); }} className="bg-gray-900 text-white px-4 py-2 rounded flex items-center gap-2">
                    <Icons.Plus /> เพิ่มห้องพัก
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {rooms.map(room => (
                    <div key={room.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xl font-bold text-gray-900">{room.number}</span>
                            <StatusBadge status={room.status} />
                        </div>
                        <div className="text-sm text-gray-600 mb-1">{room.roomTypeName || 'Unknown Type'}</div>
                        <div className="text-xs text-gray-400">ชั้น {room.floor || '-'}</div>

                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow rounded border flex">
                            <button onClick={() => { setEditingRoom(room); setShowModal(true); }} className="p-1 hover:bg-gray-100 text-blue-600"><Icons.Edit /></button>
                            <button onClick={() => setToDelete(room)} className="p-1 hover:bg-gray-100 text-red-600"><Icons.Trash /></button>
                        </div>
                    </div>
                ))}
            </div>
            {rooms.length === 0 && <div className="text-center py-10 text-gray-400">ยังไม่มีข้อมูลห้องพัก</div>}
        </div>
    );
}
