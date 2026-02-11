import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export async function navigateToDetail(router: AppRouterInstance, id: string) {
    if (!id) return;
    try {
        const apRef = doc(db, 'appointments', id);
        const apSnap = await getDoc(apRef);
        if (apSnap.exists()) {
            router.push(`/appointments/${id}`);
            return;
        }

        const bkRef = doc(db, 'bookings', id);
        const bkSnap = await getDoc(bkRef);
        if (bkSnap.exists()) {
            router.push(`/bookings/${id}`);
            return;
        }

        alert('ไม่พบข้อมูลรายละเอียดสำหรับ ID นี้');
    } catch (err) {
        console.error('navigateToDetail error', err);
        alert('เกิดข้อผิดพลาดในการเปิดรายละเอียด');
    }
}
