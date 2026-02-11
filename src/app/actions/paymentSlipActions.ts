"use server";

import { db } from "@/app/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { AuthContext, requireAdminAuth, requireLineAuth } from "@/app/lib/authUtils";

const DEFAULT_RETENTION_DAYS = 30;
const MAX_SLIP_BYTES = 2 * 1024 * 1024; // 2MB

const toByteSize = (base64Data: string) => {
  const padding = (base64Data.match(/=+$/)?.[0]?.length || 0);
  return Math.floor((base64Data.length * 3) / 4) - padding;
};

const parseDataUrl = (raw: string) => {
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64Data: match[2] };
  }
  return { mimeType: "image/jpeg", base64Data: raw };
};

const getRetentionDays = () => {
  const env = Number(process.env.PAYMENT_SLIP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_RETENTION_DAYS;
};

const bytesToMB = (bytes: number) => Number((bytes / (1024 * 1024)).toFixed(2));

const chunk = <T,>(items: T[], size: number): T[][] => {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
};

export async function submitPaymentSlip(
  appointmentId: string,
  payload: { slipBase64: string; note?: string },
  auth?: AuthContext
) {
  try {
    if (!appointmentId) return { success: false, error: "Missing appointment id." };
    if (!payload?.slipBase64) return { success: false, error: "Missing payment slip." };

    const lineAuth = await requireLineAuth(auth);
    if (!lineAuth.ok) return { success: false, error: lineAuth.error };
    const lineUserId = lineAuth.value.userId;
    if (!lineUserId && process.env.NODE_ENV === "production") {
      return { success: false, error: "Missing LINE user." };
    }

    const appointmentRef = db.collection("appointments").doc(appointmentId);
    const appointmentSnap = await appointmentRef.get();
    if (!appointmentSnap.exists) return { success: false, error: "Appointment not found." };
    const appointmentData: any = appointmentSnap.data() || {};
    if (appointmentData?.userId && lineUserId && appointmentData.userId !== lineUserId) {
      return { success: false, error: "Unauthorized appointment access." };
    }

    const { mimeType, base64Data } = parseDataUrl(payload.slipBase64.trim());
    if (!/^image\//.test(mimeType)) return { success: false, error: "Invalid slip format." };
    const sizeBytes = toByteSize(base64Data);
    if (!sizeBytes || sizeBytes <= 0) return { success: false, error: "Invalid slip content." };
    if (sizeBytes > MAX_SLIP_BYTES) return { success: false, error: "Slip image is too large (max 2MB)." };

    const retentionDays = getRetentionDays();
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    const slipRef = db.collection("payment_slips").doc();
    await slipRef.set({
      appointmentId,
      userId: lineUserId || appointmentData?.userId || null,
      slipBase64: `data:${mimeType};base64,${base64Data}`,
      mimeType,
      sizeBytes,
      note: payload.note?.trim() || null,
      status: "submitted",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      source: "customer_liff",
    });

    await appointmentRef.update({
      "paymentInfo.paymentStatus": "pending_verification",
      "paymentInfo.latestSlipId": slipRef.id,
      "paymentInfo.slipSubmittedAt": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      slipId: slipRef.id,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error: any) {
    console.error("submitPaymentSlip error:", error);
    return { success: false, error: error.message || "Submit payment slip failed." };
  }
}

export async function getPaymentSlipsByAppointmentForAdmin(appointmentId: string, auth?: AuthContext) {
  try {
    const adminAuth = await requireAdminAuth(auth);
    if (!adminAuth.ok) return { success: false, error: adminAuth.error, slips: [] };
    if (!appointmentId) return { success: false, error: "Missing appointment id.", slips: [] };

    const snap = await db.collection("payment_slips").where("appointmentId", "==", appointmentId).get();
    const slips = snap.docs
      .map((d: any) => {
        const data = d.data() || {};
        const createdAt = typeof data.createdAt?.toDate === "function" ? data.createdAt.toDate() : null;
        return {
          id: d.id,
          slipBase64: data.slipBase64 || "",
          mimeType: data.mimeType || "",
          sizeBytes: data.sizeBytes || 0,
          note: data.note || "",
          status: data.status || "submitted",
          createdAt: createdAt ? createdAt.toISOString() : null,
          expiresAt: typeof data.expiresAt?.toDate === "function" ? data.expiresAt.toDate().toISOString() : null,
        };
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

    return { success: true, slips };
  } catch (error: any) {
    console.error("getPaymentSlipsByAppointmentForAdmin error:", error);
    return { success: false, error: error.message || "Load slips failed.", slips: [] };
  }
}

export async function getPaymentSlipStorageStatsForAdmin(auth?: AuthContext) {
  try {
    const adminAuth = await requireAdminAuth(auth);
    if (!adminAuth.ok) return { success: false, error: adminAuth.error };

    const snap = await db.collection("payment_slips").get();
    const now = new Date();
    const cut3 = new Date(now);
    cut3.setMonth(cut3.getMonth() - 3);
    const cut6 = new Date(now);
    cut6.setMonth(cut6.getMonth() - 6);
    const cut12 = new Date(now);
    cut12.setFullYear(cut12.getFullYear() - 1);

    let totalBytes = 0;
    let older3Count = 0;
    let older6Count = 0;
    let older12Count = 0;
    let older3Bytes = 0;
    let older6Bytes = 0;
    let older12Bytes = 0;

    snap.docs.forEach((docSnap: any) => {
      const data = docSnap.data() || {};
      const sizeBytes = Number(data.sizeBytes || 0);
      const createdAt =
        typeof data.createdAt?.toDate === "function" ? data.createdAt.toDate() : null;

      totalBytes += sizeBytes;
      if (!createdAt) return;

      if (createdAt <= cut3) {
        older3Count += 1;
        older3Bytes += sizeBytes;
      }
      if (createdAt <= cut6) {
        older6Count += 1;
        older6Bytes += sizeBytes;
      }
      if (createdAt <= cut12) {
        older12Count += 1;
        older12Bytes += sizeBytes;
      }
    });

    return {
      success: true,
      stats: {
        totalCount: snap.size,
        totalBytes,
        totalMB: bytesToMB(totalBytes),
        olderThan3Months: { count: older3Count, bytes: older3Bytes, mb: bytesToMB(older3Bytes) },
        olderThan6Months: { count: older6Count, bytes: older6Bytes, mb: bytesToMB(older6Bytes) },
        olderThan12Months: { count: older12Count, bytes: older12Bytes, mb: bytesToMB(older12Bytes) },
        generatedAt: now.toISOString(),
      },
    };
  } catch (error: any) {
    console.error("getPaymentSlipStorageStatsForAdmin error:", error);
    return { success: false, error: error.message || "Load storage stats failed." };
  }
}

export async function cleanupPaymentSlipsOlderThanMonthsForAdmin(months: number, auth?: AuthContext) {
  try {
    const adminAuth = await requireAdminAuth(auth);
    if (!adminAuth.ok) return { success: false, error: adminAuth.error };

    const normalizedMonths = Number(months);
    if (![3, 6, 12].includes(normalizedMonths)) {
      return { success: false, error: "Allowed values are 3, 6, 12 months only." };
    }

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - normalizedMonths);
    const cutoffTs = Timestamp.fromDate(cutoff);

    const slipsSnap = await db
      .collection("payment_slips")
      .where("createdAt", "<=", cutoffTs)
      .get();

    if (slipsSnap.empty) {
      return {
        success: true,
        deletedCount: 0,
        releasedBytes: 0,
        releasedMB: 0,
        updatedAppointments: 0,
      };
    }

    const slipDocs = slipsSnap.docs;
    const slipIds = slipDocs.map((d: any) => d.id);
    const releasedBytes = slipDocs.reduce((sum: number, d: any) => sum + Number(d.data()?.sizeBytes || 0), 0);

    const appointmentRefsToClear: any[] = [];
    for (const ids of chunk(slipIds, 10)) {
      const appSnap = await db
        .collection("appointments")
        .where("paymentInfo.latestSlipId", "in", ids)
        .get();
      appSnap.docs.forEach((d: any) => appointmentRefsToClear.push(d.ref));
    }

    const deleteTargets = slipDocs.map((d: any) => ({ ref: d.ref, type: "slip" as const }));
    const clearTargets = appointmentRefsToClear.map((ref: any) => ({ ref, type: "appointment" as const }));
    const allTargets = [...deleteTargets, ...clearTargets];

    for (const batchItems of chunk(allTargets, 400)) {
      const batch = db.batch();
      batchItems.forEach((item) => {
        if (item.type === "slip") {
          batch.delete(item.ref);
        } else {
          batch.update(item.ref, {
            "paymentInfo.latestSlipId": null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
      await batch.commit();
    }

    return {
      success: true,
      deletedCount: slipDocs.length,
      releasedBytes,
      releasedMB: bytesToMB(releasedBytes),
      updatedAppointments: appointmentRefsToClear.length,
    };
  } catch (error: any) {
    console.error("cleanupPaymentSlipsOlderThanMonthsForAdmin error:", error);
    return { success: false, error: error.message || "Cleanup failed." };
  }
}
