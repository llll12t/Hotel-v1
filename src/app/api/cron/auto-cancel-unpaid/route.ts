import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireApiKey } from '@/app/lib/apiAuth';
import { sendAppointmentCancelledFlexMessage } from '@/app/actions/lineFlexActions';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const getBangkokDateParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = Number(parts.find(p => p.type === 'year')?.value || 0);
    const month = Number(parts.find(p => p.type === 'month')?.value || 0);
    const day = Number(parts.find(p => p.type === 'day')?.value || 0);
    return { year, month, day };
};

const getBangkokEndOfDay = (date = new Date()) => {
    const { year, month, day } = getBangkokDateParts(date);
    const utcMillis = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - BANGKOK_OFFSET_MS;
    return new Date(utcMillis);
};

const toDateSafe = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
};

export async function GET(request: NextRequest) {
    try {
        const auth = requireApiKey(request, 'CRON_SECRET');
        if (!auth.ok) return auth.response;

        const now = new Date();
        const snap = await db.collection('appointments')
            .where('status', 'in', ['pending', 'awaiting_confirmation'])
            .get();

        if (snap.empty) {
            return NextResponse.json({ success: true, cancelled: 0, message: 'No pending appointments' });
        }

        let cancelledCount = 0;
        const updates: Promise<any>[] = [];

        snap.forEach(doc => {
            const data: any = doc.data();
            const paymentStatus = data?.paymentInfo?.paymentStatus;
            if (paymentStatus === 'paid') return;

            const dueAt = toDateSafe(data?.paymentInfo?.paymentDueAt);
            const createdAt = toDateSafe(data?.createdAt);
            const fallbackDue = createdAt ? getBangkokEndOfDay(createdAt) : getBangkokEndOfDay(now);
            const effectiveDue = dueAt || fallbackDue;

            if (effectiveDue.getTime() > now.getTime()) return;

            cancelledCount += 1;
            updates.push(
                db.collection('appointments').doc(doc.id).update({
                    status: 'cancelled',
                    cancelReason: 'Auto-cancel: unpaid by end of day',
                    cancelledAt: FieldValue.serverTimestamp(),
                    cancelledBy: 'system',
                    updatedAt: FieldValue.serverTimestamp(),
                }).then(async () => {
                    if (data?.userId) {
                        try {
                            await sendAppointmentCancelledFlexMessage(
                                data.userId,
                                { id: doc.id, ...data },
                                'ชำระเงินไม่ทันภายในวันนี้ ระบบยกเลิกอัตโนมัติ'
                            );
                        } catch (err) {
                            console.error('sendAppointmentCancelledFlexMessage failed', err);
                        }
                    }
                })
            );
        });

        await Promise.all(updates);

        return NextResponse.json({
            success: true,
            cancelled: cancelledCount,
            checked: snap.size,
            now: now.toISOString(),
        });
    } catch (error: any) {
        console.error('Auto-cancel cron error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
