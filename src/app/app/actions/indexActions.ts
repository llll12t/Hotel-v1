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
  error?: string;
}

// Queries that are known to require or potentially require composite indexes.
const REQUIRED_INDEXES = [
  {
    name: 'appointments_by_phone_status_date_time',
    description: 'Employee search: phone + status + order by date/time',
    collection: 'appointments',
    query: (ref: any) =>
      ref
        .where('customerInfo.phone', '==', '0000000000')
        .where('status', 'in', ['confirmed', 'awaiting_confirmation', 'pending', 'in_progress'])
        .orderBy('date', 'asc')
        .orderBy('time', 'asc'),
  },
  {
    name: 'appointments_by_date_time_status',
    description: 'Slot check: date + time + status',
    collection: 'appointments',
    query: (ref: any) =>
      ref
        .where('date', '==', '2024-01-01')
        .where('time', '==', '10:00')
        .where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation', 'blocked']),
  },
  {
    name: 'appointments_by_date_time_technician_status',
    description: 'Slot check by technician: date + time + technician + status',
    collection: 'appointments',
    query: (ref: any) =>
      ref
        .where('date', '==', '2024-01-01')
        .where('time', '==', '10:00')
        .where('technicianId', '==', 'test-tech')
        .where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation', 'blocked', 'in_progress']),
  },
  {
    name: 'appointments_by_user_date',
    description: 'Customer appointments: userId + date range',
    collection: 'appointments',
    query: (ref: any) => ref.where('userId', '==', 'test-user-id').where('date', '>=', '2024-01-01').orderBy('date', 'asc'),
  },
  {
    name: 'appointments_by_technician_date_time',
    description: 'Technician schedule: technician + date range + time order',
    collection: 'appointments',
    query: (ref: any) => ref.where('technicianId', '==', 'test-tech').where('date', '>=', '2024-01-01').orderBy('date', 'asc').orderBy('time', 'asc'),
  },
  {
    name: 'roomTypes_by_status_name',
    description: 'Customer room type list: status + order by name',
    collection: 'roomTypes',
    query: (ref: any) => ref.where('status', '==', 'available').orderBy('name', 'asc'),
  },
  {
    name: 'pointMerges_by_customerPhone_mergedAt',
    description: 'Point merge history by phone ordered by mergedAt',
    collection: 'pointMerges',
    query: (ref: any) => ref.where('customerPhone', '==', '0000000000').orderBy('mergedAt', 'desc'),
  },
  {
    name: 'reviews_by_rating_createdAt',
    description: 'Admin reviews page: filter rating + order by createdAt',
    collection: 'reviews',
    query: (ref: any) => ref.where('rating', '==', 5).orderBy('createdAt', 'desc'),
  },
  {
    name: 'customers_by_phone',
    description: 'Customer lookup by phone',
    collection: 'customers',
    query: (ref: any) => ref.where('phone', '==', '0000000000'),
  },
  {
    name: 'customers_by_lineUserId',
    description: 'Customer lookup by LINE user id',
    collection: 'customers',
    query: (ref: any) => ref.where('lineUserId', '==', 'test-line-id'),
  },
  {
    name: 'reviews_by_appointmentId',
    description: 'Review lookup by appointment id',
    collection: 'reviews',
    query: (ref: any) => ref.where('appointmentId', '==', 'test-appointment-id'),
  },
  {
    name: 'admins_orderBy_firstName',
    description: 'Admin list ordered by firstName',
    collection: 'admins',
    query: (ref: any) => ref.orderBy('firstName', 'asc'),
  },
];

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
        message: 'Index ready',
      });
    } catch (error: any) {
      const errorMessage = error?.message || '';
      const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s\)]+/);
      const indexUrl = urlMatch ? urlMatch[0] : null;

      if (indexUrl) {
        indexUrls.push({
          name: indexConfig.name,
          description: indexConfig.description,
          url: indexUrl,
        });
      }

      results.push({
        name: indexConfig.name,
        description: indexConfig.description,
        status: 'missing',
        message: indexUrl ? 'Missing index' : errorMessage,
        url: indexUrl,
      });
    }
  }

  return {
    success: true,
    totalChecked: REQUIRED_INDEXES.length,
    okCount: results.filter((r) => r.status === 'ok').length,
    missingCount: results.filter((r) => r.status === 'missing').length,
    results,
    indexUrls,
  };
}

export async function getMissingIndexUrls(auth?: AuthContext) {
  const { indexUrls, success, error } = (await testAllIndexes(auth)) as any;
  if (!success) {
    return { success: false, error };
  }
  return {
    success: true,
    urls: indexUrls,
  };
}
