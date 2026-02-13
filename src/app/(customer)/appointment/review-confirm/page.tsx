"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { th } from "date-fns/locale";
import { db } from "@/app/lib/firebase";
import { useLiffContext } from "@/context/LiffProvider";
import { createBooking } from "@/app/actions/appointmentActions";
import { submitPaymentSlip } from "@/app/actions/paymentSlipActions"; // Assuming this exists or I handle it manually
import { useToast } from "@/app/components/Toast";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import { RoomType } from "@/types";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";

// --- Icons ---
const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-500">
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
  </svg>
);

const EditIcon = () => (
  <span className="text-xs bg-[#dadada] text-[#555] px-3 py-1 rounded-full font-medium cursor-pointer hover:bg-gray-300 transition-colors">
    edit
  </span>
);

interface Coupon {
  id: string;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  used?: boolean;
}

const createBookingSuccessFlex = (payload: {
  bookingId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  currencySymbol: string;
}) => {
  // Simplified Flex Message for success
  return {
    type: "flex",
    altText: `จองห้องสำเร็จ ${payload.totalPrice.toLocaleString()} ${payload.currencySymbol}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "จองห้องสำเร็จ", weight: "bold", size: "xl", align: "center", color: "#1DB446" },
          { type: "text", text: `ID: ${payload.bookingId.slice(0, 8).toUpperCase()}`, size: "xs", align: "center", color: "#aaaaaa", margin: "sm" }
        ]
      }
    }
  };
};

function ReviewConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading: liffLoading, liff } = useLiffContext();
  const { showToast } = useToast();

  const roomTypeId = searchParams.get("roomTypeId");
  const incomingCheckIn = searchParams.get("checkIn");
  const incomingCheckOut = searchParams.get("checkOut");
  const incomingGuests = searchParams.get("guests");
  const incomingRooms = searchParams.get("rooms");
  const incomingNights = searchParams.get("nights");
  const incomingCouponId = searchParams.get("couponId");

  const fullName = searchParams.get("fullName") || "";
  const phone = searchParams.get("phone") || "";
  const email = searchParams.get("email") || "";
  const note = searchParams.get("note") || "";

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [checkIn] = useState(incomingCheckIn || format(new Date(), "yyyy-MM-dd"));
  const [checkOut] = useState(incomingCheckOut || format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [guests, setGuests] = useState(Number(incomingGuests) || 2);
  const [roomsCount, setRoomsCount] = useState(Number(incomingRooms) || 1);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState(incomingCouponId || "");
  const [showCouponModal, setShowCouponModal] = useState(false);

  // Payment State
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [promptPayNo, setPromptPayNo] = useState("");
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!roomTypeId) {
        router.push("/appointment");
        return;
      }

      setLoading(true);
      try {
        // 1. Fetch Room Data
        const docRef = doc(db, "roomTypes", roomTypeId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const roomTypeData = snap.data() as Omit<RoomType, "id">;
          setRoomType({ id: snap.id, ...roomTypeData });
        } else {
          router.push("/appointment");
          return;
        }

        // 2. Fetch Coupons
        if (profile?.userId) {
          const couponsQ = query(
            collection(db, "customers", profile.userId, "coupons"),
            where("used", "==", false)
          );
          const couponsSnap = await getDocs(couponsQ);
          setAvailableCoupons(
            couponsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Coupon, "id">) }))
          );
        }

        // 3. Fetch Payment Settings (PromptPay) - Optional
        try {
          const paymentSettingsSnap = await getDoc(doc(db, "settings", "payment"));
          if (paymentSettingsSnap.exists()) {
            const settings = paymentSettingsSnap.data();
            if (settings?.promptPayAccount) {
              setPromptPayNo(settings.promptPayAccount);
            }
          }
        } catch (settingsError) {
          console.warn("Could not fetch payment settings:", settingsError);
          // Continue without settings
        }
      } catch (error) {
        console.error("Error loading data", error);
      } finally {
        setLoading(false);
      }
    };

    if (!liffLoading) fetchData();
  }, [roomTypeId, router, profile?.userId, liffLoading]);

  const nights = useMemo(() => {
    const fromParam = Number(incomingNights || "0");
    if (fromParam > 0) return fromParam;
    return Math.max(1, differenceInCalendarDays(new Date(checkOut), new Date(checkIn)) || 1);
  }, [incomingNights, checkIn, checkOut]);

  const basePrice = roomType?.basePrice || 0;
  const originalTotalPrice = basePrice * nights * Math.max(1, roomsCount);

  const selectedCoupon = availableCoupons.find((c) => c.id === selectedCouponId);
  let discountAmount = 0;
  if (selectedCoupon) {
    discountAmount =
      selectedCoupon.discountType === "percentage"
        ? Math.round(originalTotalPrice * (selectedCoupon.discountValue / 100))
        : selectedCoupon.discountValue;
    discountAmount = Math.min(discountAmount, originalTotalPrice);
  }
  const finalTotalPrice = Math.max(0, originalTotalPrice - discountAmount);

  // Generate QR Code when total price or promptpay number changes
  useEffect(() => {
    const genQR = async () => {
      if (finalTotalPrice > 0 && promptPayNo) {
        try {
          const payload = generatePayload(promptPayNo, { amount: finalTotalPrice });
          const url = await QRCode.toDataURL(payload, { width: 400, margin: 1 });
          setQrCodeUrl(url);
        } catch (e) {
          console.error("QR Gen Error", e);
        }
      }
    };
    genQR();
  }, [finalTotalPrice, promptPayNo]);


  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM", { locale: th }); // e.g. 13 กพ
    } catch {
      return dateStr;
    }
  };

  const handleEditSearch = () => {
    router.push('/appointment');
  };

  const handleBackToGuestInfo = () => {
    const params = new URLSearchParams();
    params.set("roomTypeId", roomTypeId || "");
    params.set("checkIn", checkIn);
    params.set("checkOut", checkOut);
    params.set("guests", String(guests));
    params.set("rooms", String(roomsCount));
    params.set("nights", String(nights));
    params.set("fullName", fullName);
    params.set("phone", phone);
    params.set("email", email);
    params.set("note", note);
    if (selectedCouponId) params.set("couponId", selectedCouponId);
    router.push(`/appointment/guest-info?${params.toString()}`);
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setSlipImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = async () => {
    if (!profile?.userId) {
      showToast("กรุณาเข้าสู่ระบบก่อนทำการจอง", "warning");
      return;
    }
    if (!roomType) {
      showToast("ไม่พบข้อมูลห้องพัก", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingData = {
        userId: profile.userId,
        roomTypeId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
        rooms: Math.max(1, roomsCount),
        guests: Number.isFinite(guests) ? guests : 1,
        status: slipImage ? "awaiting_confirmation" : "pending", // If slip attached, await confirm. Else pending payment.
        customerInfo: { fullName, phone, email, note, pictureUrl: profile.pictureUrl || "" },
        paymentInfo: {
          originalPrice: originalTotalPrice,
          totalPrice: finalTotalPrice,
          discount: discountAmount,
          couponId: selectedCouponId || null,
          couponName: selectedCoupon?.name || null,
          paymentStatus: slipImage ? "pending_verification" : "unpaid",
        },
      };

      const lineAccessToken = liff?.getAccessToken?.();
      const result = await createBooking(bookingData, { lineAccessToken });

      if (!result.success) {
        showToast(typeof result.error === "string" ? result.error : "เกิดข้อผิดพลาด", "error");
        setIsSubmitting(false);
        return;
      }

      // If slip exists, submit it
      if (slipImage && result.id) {
        await submitPaymentSlip(result.id, { slipBase64: slipImage, note: "Uploaded during booking" }, { lineAccessToken });
      }

      if (liff?.isInClient()) {
        try {
          const flex = createBookingSuccessFlex({
            bookingId: result.id || "",
            roomTypeName: roomType?.name || "",
            checkIn: formatDate(checkIn),
            checkOut: formatDate(checkOut),
            totalPrice: finalTotalPrice,
            currencySymbol: roomType?.currencySymbol || "฿",
          });
          await liff.sendMessages([flex as unknown as object]);
        } catch (msgError) {
          console.warn("Flex Error", msgError);
        }
      }

      showToast("จองห้องพักสำเร็จ!", "success");
      router.push("/my-appointments");
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการจอง", "error");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen spinnerStyle={{ animationDuration: "3s" }} />;
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-24 font-sans p-4">

      {/* Combined Room & Booking Details Card */}
      <div className="bg-white rounded-xl p-5 mb-2  border border-gray-100">
        {/* Room Header - Compact */}
        <div className="flex gap-4 mb-2">
          <div className="w-20 h-20 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
            {roomType?.imageUrls?.[0] ? (
              <img src={roomType.imageUrls[0]} alt={roomType.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>
            )}
          </div>
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <h3 className="text-base font-bold text-gray-900 leading-tight truncate pr-2">{roomType?.name}</h3>
              <div className="flex items-center gap-1 flex-shrink-0 bg-gray-50 px-1.5 py-0.5 rounded-md">
                <StarIcon />
                <span className="text-xs font-bold text-gray-900">4.9</span>
              </div>
            </div>
            <p className="text-sm font-bold text-gray-900 mt-1">{roomType?.basePrice?.toLocaleString()} บาท/คืน</p>
            <p className="text-[10px] text-gray-400 mt-0.5">10 reviews</p>
          </div>
        </div>

        <hr className="my-5 border-gray-100" />

        {/* Youbooking Details */}
        <div>
          <h3 className="text-base font-bold text-gray-900 mb-4">Youbooking</h3>

          <div className="space-y-5">
            {/* DATES */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">DATES</p>
                <p className="text-sm font-bold text-gray-900">{formatDate(checkIn)} - {formatDate(checkOut)}</p>
              </div>
              <div onClick={handleEditSearch}><EditIcon /></div>
            </div>

            {/* GUESTS */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">GUESTS</p>
                <p className="text-sm font-bold text-gray-900">{guests} Gusts ( {roomsCount} Room )</p>
              </div>
              <div onClick={handleEditSearch}><EditIcon /></div>
            </div>

            {/* CONTACT */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">CONTACT</p>
                <p className="text-sm font-bold text-gray-900">{fullName || "jame"}</p>
              </div>
              <div onClick={handleBackToGuestInfo}><EditIcon /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Card */}
      <div className="bg-white rounded-xl p-5 mb-5  border border-gray-100">
        <div className="mb-6">
          <h3 className="text-base font-bold text-gray-900 uppercase mb-4">PAYMENT</h3>
          <div className="flex justify-between items-center border-b border-gray-200 pb-4">
            <div>
              <p className="text-[10px] text-gray-400 font-bold mb-1">Total cost</p>
              <p className="text-2xl font-bold text-gray-900">{finalTotalPrice.toLocaleString()}</p>
            </div>
            <button
              onClick={() => setShowCouponModal(!showCouponModal)}
              className="bg-[#FF754B] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md hover:opacity-90 transition-opacity"
            >
              {selectedCoupon ? 'Change coupon' : 'Add coupon'}
            </button>
          </div>
        </div>

        {showCouponModal && (
          <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100 animate-fade-in-down">
            <p className="text-xs font-bold text-gray-500 mb-2">Available Coupons</p>
            {availableCoupons.length === 0 ? <p className="text-xs text-gray-400 italic">No coupons found.</p> :
              availableCoupons.map(c => (
                <div key={c.id} onClick={() => setSelectedCouponId(selectedCouponId === c.id ? '' : c.id)} className={`p-2 border rounded-lg mb-2 text-xs flex justify-between ${selectedCouponId === c.id ? 'border-[#FF754B] bg-orange-50' : 'border-gray-200'}`}>
                  <span>{c.name}</span>
                  <span>-{c.discountValue}</span>
                </div>
              ))}
          </div>
        )}

        <div className="flex flex-col items-center">
          <div className="w-[200px] h-[200px] bg-black rounded-lg overflow-hidden mb-6 relative border border-gray-200  flex items-center justify-center">
            {slipImage ? (
              <img src={slipImage} alt="Payment Slip" className="w-full h-full object-cover" />
            ) : (
              qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Payment QR" className="w-full h-full object-cover p-2 bg-white" />
              ) : (
                <div className="text-white text-xs text-center p-2">
                  {!promptPayNo ? "No PromptPay ID" : "Generating QR..."}
                </div>
              )
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#FF754B] text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-all text-sm mb-2"
          >
            {slipImage ? 'เปลี่ยนรูปสลิป' : 'อัพโหลดยืนยันชำระเงิน'}
          </button>
        </div>
      </div>

      {/* Bottom Confirm Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 z-50 rounded-t-[32px]">
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="w-full bg-black text-white font-medium text-base py-4 rounded-xl shadow-lg hover:opacity-90 disabled:opacity-70 transition-all"
        >
          {isSubmitting ? 'Processing...' : 'Confirm'}
        </button>
      </div>

    </div>
  );
}

export default function ReviewConfirmPage() {
  return (
    <Suspense fallback={<LoadingScreen spinnerStyle={{ animationDuration: "3s" }} />}>
      <ReviewConfirmContent />
    </Suspense>
  );
}
