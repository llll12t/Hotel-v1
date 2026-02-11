'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export interface IndexStatus {
    success: boolean;
    totalChecked?: number;
    okCount?: number;
    missingCount?: number;
    results?: any[];
    indexUrls?: any[];
    urls?: any[];
}

/**
 * รายการ Queries ที่ต้องการ Composite Index ใน Firestore
 * แต่ละ query จะถูกทดสอบและเก็บ error URL สำหรับสร้าง Index
 */
const REQUIRED_INDEXES = [
    {
        name: 'appointments_by_phone_date_status',
        description: 'ค้นหานัดหมายตามเบอร์โทร + วันที่ + สถานะ',
        collection: 'appointments',
        query: (ref: any) => ref
            .where('customerInfo.phone', '==', '0000000000')
            .where('date', '>=', '2024-01-01')
            .where('status', 'in', ['confirmed', 'awaiting_confirmation'])
            .orderBy('date', 'asc')
            .orderBy('time', 'asc')
    },
    {
        name: 'appointments_by_date_time_status',
        description: 'ตรวจสอบ slot ว่าง (วันที่ + เวลา + สถานะ)',
        collection: 'appointments',
        query: (ref: any) => ref
            .where('date', '==', '2024-01-01')
            .where('time', '==', '10:00')
            .where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
    },
    {
        name: 'appointments_by_date_time_tech_status',
        description: 'ตรวจสอบ slot ว่าง + ช่าง',
        collection: 'appointments',
        query: (ref: any) => ref
            .where('date', '==', '2024-01-01')
            .where('time', '==', '10:00')
            .where('technicianId', '==', 'test-tech')
            .where('status', 'in', ['confirmed', 'awaiting_confirmation', 'in_progress'])
    },
    {
        name: 'appointments_by_userId_date',
        description: 'ดึงนัดหมายของลูกค้า',
        collection: 'appointments',
        query: (ref: any) => ref
            .where('userId', '==', 'test-user-id')
            .where('date', '>=', '2024-01-01')
            .orderBy('date', 'asc')
    },
    {
        name: 'services_by_status_orderBy_name',
        description: 'ดึงบริการที่พร้อมให้บริการ',
        collection: 'services',
        query: (ref: any) => ref
            .where('status', 'in', ['available', 'unavailable'])
            .orderBy('serviceName')
    },
    {
        name: 'employees_by_techId_date_time',
        description: 'ตารางงานพนักงาน',
        collection: 'appointments',
        query: (ref: any) => ref
            .where('technicianId', '==', 'test-tech')
            .where('date', '>=', '2024-01-01')
            .orderBy('date', 'asc')
            .orderBy('time', 'asc')
    },
    {
        name: 'pointMerge_by_phone',
        description: 'ประวัติการรวมพ้อยต์',
        collection: 'pointMerges',
        query: (ref: any) => ref
            .where('customerPhone', '==', '0000000000')
            .orderBy('mergedAt', 'desc')
    },
    {
        name: 'customers_by_phone',
        description: 'ค้นหาลูกค้าตามเบอร์โทร',
        collection: 'customers',
        query: (ref: any) => ref.where('phone', '==', '0000000000')
    },
    {
        name: 'customers_by_lineUserId',
        description: 'ค้นหาลูกค้าตาม LINE User ID',
        collection: 'customers',
        query: (ref: any) => ref.where('lineUserId', '==', 'test-line-id')
    },
    {
        name: 'reviews_by_appointmentId',
        description: 'ดึงรีวิวของนัดหมาย',
        collection: 'reviews',
        query: (ref: any) => ref.where('appointmentId', '==', 'test-appointment-id')
    },
    {
        name: 'admins_orderBy_firstName',
        description: 'ดึงรายชื่อแอดมิน',
        collection: 'admins',
        query: (ref: any) => ref.orderBy('firstName')
    }
];

/**
 * ทดสอบ Query ทั้งหมดและเก็บ Index URLs ที่ต้องสร้าง
 */
export async function testAllIndexes(auth?: AuthContext) {
    const adminAuth = await requireAdminAuth(auth);
    if (!adminAuth.ok) {
        return { success: false, error: adminAuth.error };
    }

    const results = [];
    const indexUrls = [];

    for (const indexConfig of REQUIRED_INDEXES) {
        try {
            const ref = db.collection(indexConfig.collection);
            const q = indexConfig.query(ref);
            await q.limit(1).get();

            results.push({
                name: indexConfig.name,
                description: indexConfig.description,
                status: 'ok',
                message: 'Index พร้อมใช้งาน'
            });
        } catch (error: any) {
            const errorMessage = error.message || '';

            // Extract index creation URL from error
            const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s\)]+/);
            const indexUrl = urlMatch ? urlMatch[0] : null;

            if (indexUrl) {
                indexUrls.push({
                    name: indexConfig.name,
                    description: indexConfig.description,
                    url: indexUrl
                });
            }

            results.push({
                name: indexConfig.name,
                description: indexConfig.description,
                status: 'missing',
                message: indexUrl ? 'ต้องสร้าง Index' : errorMessage,
                url: indexUrl
            });
        }
    }

    return {
        success: true,
        totalChecked: REQUIRED_INDEXES.length,
        okCount: results.filter(r => r.status === 'ok').length,
        missingCount: results.filter(r => r.status === 'missing').length,
        results,
        indexUrls  // URLs for missing indexes
    };
}

/**
 * รับรายการ Index URLs ที่ต้องสร้างเท่านั้น
 */
export async function getMissingIndexUrls(auth?: AuthContext) {
    const { indexUrls, success, error } = await testAllIndexes(auth) as any;
    if (!success) {
        return { success: false, error };
    }
    return {
        success: true,
        urls: indexUrls
    };
}
