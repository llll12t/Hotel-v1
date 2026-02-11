"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import { db } from "@/app/lib/firebase";
import { useLiffContext } from "@/context/LiffProvider";
import ImageUploadBase64 from "@/app/components/ImageUploadBase64";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import { submitPaymentSlip } from "@/app/actions/paymentSlipActions";

type PaymentMethod = "image" | "promptpay" | "bankinfo";

interface PaymentSettings {
  method?: PaymentMethod;
  qrCodeImageUrl?: string;
  promptPayAccount?: string;
  bankInfoText?: string;
}

interface AppointmentData {
  id: string;
  serviceInfo?: { name?: string };
  paymentInfo?: { totalPrice?: number; paymentDueAt?: unknown; paymentStatus?: string };
}

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const buildPaymentNotifyFlex = (params: {
  shortBookingId: string;
  serviceName: string;
  totalPrice: number;
  dueLabel: string;
  slipNote?: string;
}) => {
  const { shortBookingId, serviceName, totalPrice, dueLabel, slipNote } = params;
  const amountLabel = `${totalPrice.toLocaleString("th-TH")} บาท`;

  return {
    type: "flex",
    altText: `แจ้งชำระเงินแล้ว ${amountLabel}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        backgroundColor: "#1f1f22",
        contents: [
          {
            type: "text",
            text: "แจ้งชำระเงินแล้ว",
            color: "#FFFFFF",
            weight: "bold",
            size: "md",
          },
          {
            type: "text",
            text: `รหัสการจอง ${shortBookingId}`,
            color: "#D4D4D8",
            size: "xs",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "16px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "บริการ", size: "sm", color: "#71717A", flex: 3 },
                  { type: "text", text: serviceName || "-", size: "sm", color: "#111827", wrap: true, align: "end", flex: 7 },
                ],
              },
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "กำหนดชำระ", size: "sm", color: "#71717A", flex: 3 },
                  { type: "text", text: dueLabel, size: "sm", color: "#111827", wrap: true, align: "end", flex: 7 },
                ],
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F4F4F5",
            cornerRadius: "10px",
            paddingAll: "12px",
            contents: [
              {
                type: "text",
                text: "ยอดชำระ",
                size: "xs",
                color: "#71717A",
              },
              {
                type: "text",
                text: amountLabel,
                size: "lg",
                weight: "bold",
                color: "#111827",
                margin: "xs",
              },
            ],
          },
          ...(slipNote
            ? [
                {
                  type: "text",
                  text: `หมายเหตุ: ${slipNote}`,
                  size: "xs",
                  color: "#52525B",
                  wrap: true,
                },
              ]
            : []),
          {
            type: "text",
            text: "ส่งสลิปเรียบร้อยแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบ",
            size: "xs",
            color: "#3F3F46",
            wrap: true,
          },
        ],
      },
    },
  };
};

function PaymentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { liff } = useLiffContext();

  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [slipBase64, setSlipBase64] = useState("");
  const [slipNote, setSlipNote] = useState("");
  const [sendingNotice, setSendingNotice] = useState(false);
  const [noticeSent, setNoticeSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const resolvedAppointmentId = useMemo(() => {
    let id = (params?.appointmentId as string) || "";
    if (!id) id = (searchParams.get("appointmentId") as string) || "";

    if (!id) {
      const liffState = searchParams.get("liff.state");
      if (liffState) {
        const parts = liffState.split("/");
        const idx = parts.findIndex((p) => p === "payment");
        if (idx !== -1 && parts[idx + 1]) id = parts[idx + 1];
      }
    }

    if (!id && typeof window !== "undefined") {
      const parts = window.location.pathname.split("/");
      const idx = parts.findIndex((p) => p === "payment");
      if (idx !== -1 && parts[idx + 1]) id = parts[idx + 1];
    }
    return id;
  }, [params, searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      if (!resolvedAppointmentId) {
        setError("ไม่พบรหัสการจอง");
        setLoading(false);
        return;
      }

      try {
        const [paymentSnap, appointmentSnap] = await Promise.all([
          getDoc(doc(db, "settings", "payment")),
          getDoc(doc(db, "appointments", resolvedAppointmentId)),
        ]);

        if (!paymentSnap.exists()) throw new Error("ไม่พบการตั้งค่าการชำระเงิน");
        if (!appointmentSnap.exists()) throw new Error("ไม่พบข้อมูลการจอง");

        const settings = paymentSnap.data() as PaymentSettings;
        const appData = { id: appointmentSnap.id, ...appointmentSnap.data() } as AppointmentData;
        setPaymentSettings(settings);
        setAppointment(appData);

        if (settings.method === "image") {
          if (!settings.qrCodeImageUrl) throw new Error("ยังไม่ได้ตั้งค่ารูป QR Code");
          setQrCodeDataUrl(settings.qrCodeImageUrl);
        } else if (settings.method === "promptpay") {
          const amount = Number(appData.paymentInfo?.totalPrice || 0);
          if (!amount || amount <= 0) throw new Error("ยอดชำระไม่ถูกต้อง");
          if (!settings.promptPayAccount) throw new Error("ยังไม่ได้ตั้งค่าบัญชี PromptPay");
          const payload = generatePayload(settings.promptPayAccount, { amount });
          const qrCodeUrl = await QRCode.toDataURL(payload, { width: 360, margin: 1 });
          setQrCodeDataUrl(qrCodeUrl);
        } else if (settings.method === "bankinfo") {
          if (!settings.bankInfoText) throw new Error("ยังไม่ได้ตั้งค่าข้อมูลบัญชีธนาคาร");
        } else {
          throw new Error("รูปแบบการชำระเงินไม่ถูกต้อง");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedAppointmentId]);

  const totalPrice = Number(appointment?.paymentInfo?.totalPrice || 0);
  const serviceName = appointment?.serviceInfo?.name || "-";
  const shortBookingId = (appointment?.id || "-").slice(0, 8).toUpperCase();
  const dueDate = parseDate(appointment?.paymentInfo?.paymentDueAt);
  const dueLabel = dueDate
    ? `${dueDate.toLocaleDateString("th-TH")} ${dueDate.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "ภายในวันนี้";

  const sendPaymentNotice = async () => {
    if (!appointment || !resolvedAppointmentId) return;
    if (!slipBase64) {
      setError("กรุณาอัปโหลดสลิปก่อนแจ้งชำระเงิน");
      return;
    }

    setSendingNotice(true);
    setError("");
    try {
      const lineAccessToken = liff?.getAccessToken?.();
      const saveResult = await submitPaymentSlip(
        resolvedAppointmentId,
        { slipBase64, note: slipNote?.trim() || `แจ้งชำระจาก LIFF: ${shortBookingId}` },
        { lineAccessToken }
      );

      if (!saveResult.success) {
        throw new Error(saveResult.error || "บันทึกสลิปไม่สำเร็จ");
      }

      if (liff && typeof liff.isInClient === "function" && liff.isInClient()) {
        const flexMessage = buildPaymentNotifyFlex({
          shortBookingId,
          serviceName,
          totalPrice,
          dueLabel,
          slipNote: slipNote.trim(),
        });
        await liff.sendMessages([flexMessage as unknown as object]);
      }

      setNoticeSent(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "ส่งแจ้งชำระเงินไม่สำเร็จ");
    } finally {
      setSendingNotice(false);
    }
  };

  if (loading) {
    return <LoadingScreen spinnerStyle={{ animationDuration: "2.4s" }} />;
  }

  if (error && !appointment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f4f2] p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 text-center">
          <div className="mb-2 text-sm font-semibold text-red-700">เกิดข้อผิดพลาด</div>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f2] p-4">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-[#e6e4df] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between border-b border-[#f0efeb] pb-4">
          <div>
            <h1 className="text-base font-bold text-[#1f1f22]">ชำระเงินค่าบริการ</h1>
            <p className="mt-1 text-xs text-[#7b7b80]">รหัสการจอง {shortBookingId}</p>
          </div>
          <div className="rounded-full bg-[#f4f1ec] px-3 py-1 text-xs font-semibold text-[#5c4332]">
            {appointment?.paymentInfo?.paymentStatus === "pending_verification" ? "รอตรวจสอบสลิป" : "รอชำระเงิน"}
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-[#efede8] bg-[#faf9f7] p-4">
          <div className="text-xs text-[#78787d]">บริการ</div>
          <div className="mb-2 text-sm font-semibold text-[#202024]">{serviceName}</div>
          <div className="text-xs text-[#78787d]">ครบกำหนดชำระ</div>
          <div className="text-sm font-medium text-[#202024]">{dueLabel}</div>
          <div className="mt-3 flex items-end justify-between border-t border-[#ece9e2] pt-3">
            <span className="text-sm font-semibold text-[#2b2b30]">ยอดชำระ</span>
            <span className="text-2xl font-bold tracking-tight text-[#5c4332]">
              {totalPrice.toLocaleString()}
              <span className="ml-1 text-sm font-medium text-[#7a7a80]">บาท</span>
            </span>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-[#ece9e2] p-4">
          {paymentSettings?.method === "bankinfo" ? (
            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-[#6f6f75]">รายละเอียดบัญชี</div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#2d2d32]">{paymentSettings.bankInfoText}</pre>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-2 text-xs font-semibold tracking-wide text-[#6f6f75]">สแกนเพื่อชำระเงิน</div>
              <img
                src={qrCodeDataUrl}
                alt="QR Code"
                className="mx-auto h-[220px] w-[220px] rounded-xl border border-[#efede8] object-contain p-2"
              />
              {paymentSettings?.method === "promptpay" && paymentSettings.promptPayAccount ? (
                <div className="mt-2 text-xs text-[#6b6b70]">PromptPay: {paymentSettings.promptPayAccount}</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="mb-4 rounded-2xl border border-[#ece9e2] p-4">
          <div className="mb-2 text-xs font-semibold tracking-wide text-[#6f6f75]">อัปโหลดสลิปการชำระเงิน</div>
          <ImageUploadBase64 imageUrl={slipBase64} onImageChange={setSlipBase64} compact />
          <textarea
            value={slipNote}
            onChange={(e) => setSlipNote(e.target.value)}
            rows={2}
            placeholder="หมายเหตุ (ถ้ามี)"
            className="mt-3 w-full rounded-xl border border-[#ece9e2] px-3 py-2 text-xs text-[#303038] outline-none focus:border-[#5c4332]"
          />
        </div>

        {!!error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <button
          onClick={sendPaymentNotice}
          disabled={sendingNotice || noticeSent}
          className="w-full rounded-2xl bg-[#1f1f22] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {sendingNotice ? "กำลังแจ้งชำระเงิน..." : noticeSent ? "แจ้งชำระเงินแล้ว" : "แจ้งชำระเงิน"}
        </button>

        <p className="mt-3 text-center text-[11px] text-[#8a8a90]">
          ระบบจะจัดเก็บสลิปแยกออกจากข้อมูลการจอง และลบอัตโนมัติเมื่อครบระยะเวลาที่กำหนด
        </p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<LoadingScreen spinnerStyle={{ animationDuration: "2.4s" }} />}>
      <PaymentContent />
    </Suspense>
  );
}
