import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '@/app/lib/firebaseAdmin';
import { requireApiKey } from '@/app/lib/apiAuth';

const CHUNK_SIZE = 10;
const MAX_SLIPS_PER_RUN = 200;

const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
};

export async function GET(request: NextRequest) {
    try {
        const auth = requireApiKey(request, 'CRON_SECRET');
        if (!auth.ok) return auth.response;

        const now = new Date();
        const nowTs = Timestamp.fromDate(now);
        const expiredSnap = await db
            .collection('payment_slips')
            .where('expiresAt', '<=', nowTs)
            .limit(MAX_SLIPS_PER_RUN)
            .get();

        if (expiredSnap.empty) {
            return NextResponse.json({
                success: true,
                deleted: 0,
                updatedAppointments: 0,
                message: 'No expired payment slips',
            });
        }

        const expiredSlipIds = expiredSnap.docs.map((d) => d.id);
        const writeBatch = db.batch();

        expiredSnap.docs.forEach((slipDoc) => {
            writeBatch.delete(slipDoc.ref);
        });

        let updatedAppointments = 0;
        const idChunks = chunk(expiredSlipIds, CHUNK_SIZE);
        for (const ids of idChunks) {
            const appSnap = await db
                .collection('appointments')
                .where('paymentInfo.latestSlipId', 'in', ids)
                .get();

            appSnap.docs.forEach((appDoc) => {
                writeBatch.update(appDoc.ref, {
                    'paymentInfo.latestSlipId': null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                updatedAppointments += 1;
            });
        }

        await writeBatch.commit();

        return NextResponse.json({
            success: true,
            deleted: expiredSlipIds.length,
            updatedAppointments,
            now: now.toISOString(),
        });
    } catch (error: any) {
        console.error('cleanup-payment-slips cron error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Cleanup failed.' },
            { status: 500 }
        );
    }
}
