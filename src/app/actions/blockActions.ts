"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Appointment } from '@/types';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export async function blockAppointmentSlot(data: { date: string; time: string; technicianId?: string; duration?: number; note?: string }, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { date, time, technicianId, duration = 60, note = 'Blocked' } = data;

        // Check if slot is available (simplified check or rely on admin override)
        // Ideally we check overlap. Let's do a quick check if blocked.
        const q = db.collection('appointments')
            .where('date', '==', date)
            .where('time', '==', time)
            .where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation', 'blocked']);

        // If specific technician
        let finalQ = q;
        if (technicianId) {
            finalQ = finalQ.where('technicianId', '==', technicianId);
        }

        const snap = await finalQ.get();
        // If we want strict blocking, we might fail here. But admin might want to double book or block anyway.
        // Let's just create it. The UI should have warned or we can return warning.

        const blockData: any = {
            date,
            time,
            technicianId: technicianId || null,
            status: 'blocked',
            serviceInfo: { name: 'Blocked' },
            customerInfo: { fullName: note, name: note }, // Reuse customer name for Reason
            appointmentInfo: { duration },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: 'admin'
        };

        // Populate minimal fields to satisfy types
        if (technicianId) {
            const techSnap = await db.collection('technicians').doc(technicianId).get();
            if (techSnap.exists) {
                const t = techSnap.data();
                blockData.technicianInfo = { id: technicianId, firstName: t?.firstName, lastName: t?.lastName };
            }
        }

        await db.collection('appointments').add(blockData);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
