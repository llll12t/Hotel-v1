"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useLiffContext } from "@/context/LiffProvider";
import { submitPaymentSlip } from "@/app/actions/paymentSlipActions";
import { useToast } from "@/app/components/Toast";
import LoadingIcon from "@/app/components/common/LoadingIcon";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import { format } from "date-fns";
import { th } from "date-fns/locale";

// ── Icons ──────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const CreditCardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

// ── Main Component ─────────────────────────────────────
function PaymentContent() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params?.appointmentId as string;
  const { liff, loading: liffLoading } = useLiffContext();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<any>(null);
  const [promptPayNo, setPromptPayNo] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch appointment + settings ──
  useEffect(() => {
    if (liffLoading || !appointmentId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Appointment
        const apptSnap = await getDoc(doc(db, "appointments", appointmentId));
        if (!apptSnap.exists()) {
          showToast("ไม่พบข้อมูลการจอง", "error");
          router.push("/my-appointments");
          return;
        }
        setAppointment({ id: apptSnap.id, ...apptSnap.data() });

        // 2. PromptPay settings
        const settingsSnap = await getDoc(doc(db, "settings", "payment"));
        if (settingsSnap.exists()) {
          const s = settingsSnap.data();
          if (s?.promptPayAccount) setPromptPayNo(s.promptPayAccount);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [appointmentId, liffLoading, router, showToast]);

  // ── Generate QR ──
  useEffect(() => {
    const genQR = async () => {
      const total = appointment?.paymentInfo?.totalPrice;
      if (total > 0 && promptPayNo) {
        try {
          const payload = generatePayload(promptPayNo, { amount: total });
          const url = await QRCode.toDataURL(payload, { width: 400, margin: 1 });
          setQrCodeUrl(url);
        } catch (e) {
          console.error("QR Gen Error", e);
        }
      }
    };
    if (appointment) genQR();
  }, [appointment, promptPayNo]);

  // ── File select ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setSlipImage(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // ── Submit slip ──
  const handleSubmitSlip = async () => {
    if (!slipImage) {
      showToast("กรุณาอัพโหลดสลิปก่อน", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      const lineAccessToken = liff?.getAccessToken?.() || undefined;
      const result = await submitPaymentSlip(
        appointmentId,
        { slipBase64: slipImage, note: "Uploaded from payment page" },
        { lineAccessToken }
      );
      if (result.success) {
        showToast("ส่งสลิปสำเร็จ! รอการตรวจสอบ", "success");
        router.push("/my-appointments");
      } else {
        showToast(typeof result.error === "string" ? result.error : "เกิดข้อผิดพลาด", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการส่งสลิป", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Helpers ──
  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy", { locale: th }); } catch { return d; }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingIcon className="w-12 h-12 text-gray-300" />
      </div>
    );
  }

  const totalPrice: number = appointment?.paymentInfo?.totalPrice || 0;
  const roomName: string =
    appointment?.roomTypeInfo?.name ||
    appointment?.serviceInfo?.name ||
    "การจอง";
  const checkIn: string = appointment?.bookingInfo?.checkInDate || appointment?.date || "";
  const checkOut: string = appointment?.bookingInfo?.checkOutDate || "";
  const bookingIdShort = (appointmentId || "").slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F6F6F6] font-sans pb-32">

      <div className="max-w-md mx-auto px-4 pt-4 space-y-3">

        {/* Booking Summary */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">รายละเอียดการจอง</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">ห้องพัก</span>
              <span className="text-sm font-bold text-gray-900">{roomName}</span>
            </div>
            {checkIn && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Check-in</span>
                <span className="text-sm font-semibold text-gray-800">{formatDate(checkIn)}</span>
              </div>
            )}
            {checkOut && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Check-out</span>
                <span className="text-sm font-semibold text-gray-800">{formatDate(checkOut)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">รหัสจอง</span>
              <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">#{bookingIdShort}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 mt-1 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">ยอดชำระ</span>
              <span className="text-2xl font-bold text-gray-900">
                {totalPrice.toLocaleString()}
                <span className="text-sm font-normal text-gray-500 ml-1">บาท</span>
              </span>
            </div>
          </div>
        </div>

        {/* QR / Slip Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">สแกน QR เพื่อชำระเงิน</p>

          {/* QR / Slip Preview */}
          <div className="flex justify-center mb-5">
            <div className="w-52 h-52 rounded-2xl overflow-hidden border-2 border-gray-200 flex items-center justify-center bg-gray-50 shadow-inner">
              {slipImage ? (
                <img src={slipImage} alt="สลิป" className="w-full h-full object-cover" />
              ) : qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR PromptPay" className="w-full h-full object-cover p-2 bg-white" />
              ) : (
                <div className="text-center text-gray-400 text-xs px-4">
                  <CreditCardIcon />
                  <p className="mt-2">{!promptPayNo ? "ไม่มี PromptPay ID" : "กำลังสร้าง QR..."}</p>
                </div>
              )}
            </div>
          </div>

          {promptPayNo && (
            <p className="text-center text-xs text-gray-400 mb-4">
              PromptPay: <span className="font-semibold text-gray-700">{promptPayNo}</span>
            </p>
          )}

          {/* Upload Slip */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-[#FF754B] text-[#FF754B] font-bold py-3 rounded-xl text-sm hover:bg-orange-50 transition-all"
          >
            {slipImage ? "📷 เปลี่ยนรูปสลิป" : "📤 อัพโหลดสลิปการโอนเงิน"}
          </button>

          {slipImage && (
            <p className="text-center text-xs text-green-600 font-medium mt-2">✓ เลือกสลิปแล้ว พร้อมส่ง</p>
          )}
        </div>

        {/* Info note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
          💡 หลังจากโอนเงินแล้ว กรุณาอัพโหลดสลิปและกดยืนยัน ทีมงานจะตรวจสอบภายใน 24 ชั่วโมง
        </div>

      </div>

      {/* Bottom Confirm Button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 p-4 z-50 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <button
          onClick={handleSubmitSlip}
          disabled={!slipImage || isSubmitting}
          className="w-full bg-black text-white font-bold text-base py-4 rounded-2xl shadow-lg hover:opacity-90 disabled:opacity-40 transition-all"
        >
          {isSubmitting ? "กำลังส่ง..." : "ยืนยันการชำระเงิน"}
        </button>
      </div>

    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingIcon className="w-12 h-12 text-gray-300" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}
