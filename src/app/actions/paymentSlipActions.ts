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
