"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { th } from "date-fns/locale";
import { db } from "@/app/lib/firebase";
import { useLiffContext } from "@/context/LiffProvider";
import { createBooking } from "@/app/actions/appointmentActions";
import { useToast } from "@/app/components/Toast";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import { RoomType } from "@/types";

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
  const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;
  const paymentUrl = customerLiffId
    ? `https://liff.line.me/${customerLiffId}/payment/${payload.bookingId}`
    : null;

  return {
    type: "flex",
    altText: `จองห้องสำเร็จ ${payload.totalPrice.toLocaleString()} ${payload.currencySymbol}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "จองห้องสำเร็จ",
            weight: "bold",
            size: "lg",
            color: "#553734",
            align: "center",
          },
          {
            type: "separator",
            color: "#D9CFC3",
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เลขที่การจอง", size: "sm", color: "#666666", flex: 3 },
                  { type: "text", text: payload.bookingId.slice(0, 8).toUpperCase(), size: "sm", color: "#111111", align: "end", flex: 4 },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ประเภทห้อง", size: "sm", color: "#666666", flex: 3 },
                  { type: "text", text: payload.roomTypeName || "-", size: "sm", color: "#111111", align: "end", flex: 4, wrap: true },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เช็คอิน", size: "sm", color: "#666666", flex: 3 },
                  { type: "text", text: payload.checkIn, size: "sm", color: "#111111", align: "end", flex: 4 },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เช็คเอาท์", size: "sm", color: "#666666", flex: 3 },
                  { type: "text", text: payload.checkOut, size: "sm", color: "#111111", align: "end", flex: 4 },
                ],
              },
            ],
            paddingAll: "12px",
            backgroundColor: "#F8F8F8",
            cornerRadius: "10px",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ยอดชำระ", weight: "bold", size: "md", color: "#333333", flex: 0 },
              {
                type: "text",
                text: `${payload.totalPrice.toLocaleString()} ${payload.currencySymbol}`,
                weight: "bold",
                size: "md",
                color: "#553734",
                align: "end",
              },
            ],
            paddingAll: "12px",
            backgroundColor: "#F5F2ED",
            cornerRadius: "10px",
          },
        ],
        paddingAll: "20px",
      },
      ...(paymentUrl
        ? {
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            paddingAll: "20px",
            contents: [
              {
                type: "button",
                style: "primary",
                height: "sm",
                color: "#553734",
                action: {
                  type: "uri",
                  label: "ชำระเงิน",
                  uri: paymentUrl,
                },
              },
            ],
          },
        }
        : {}),
    },
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
  const [showCoupon, setShowCoupon] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!roomTypeId) {
        router.push("/appointment");
        return;
      }

      setLoading(true);
      try {
        const docRef = doc(db, "roomTypes", roomTypeId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const roomTypeData = snap.data() as Omit<RoomType, "id">;
          setRoomType({ id: snap.id, ...roomTypeData });
        } else {
          router.push("/appointment");
          return;
        }

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

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM", { locale: th });
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

  const handleConfirm = async () => {
    if (!profile?.userId) {
      showToast("กรุณาเข้าสู่ระบบก่อนทำการจอง", "warning");
      return;
    }
    if (!roomTypeId) {
      showToast("ไม่พบข้อมูลห้องพัก", "error");
      return;
    }
    if (!fullName || !phone) {
      showToast("ไม่พบข้อมูลลูกค้า กรุณากลับไปกรอกข้อมูล", "warning");
      handleBackToGuestInfo();
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
        status: "pending",
        customerInfo: { fullName, phone, email, note, pictureUrl: profile.pictureUrl || "" },
        paymentInfo: {
          originalPrice: originalTotalPrice,
          totalPrice: finalTotalPrice,
          discount: discountAmount,
          couponId: selectedCouponId || null,
          couponName: selectedCoupon?.name || null,
          paymentStatus: "unpaid",
        },
      };

      const lineAccessToken = liff?.getAccessToken?.();
      const result = await createBooking(bookingData, { lineAccessToken });
      if (!result.success) {
        showToast(typeof result.error === "string" ? result.error : "เกิดข้อผิดพลาด", "error");
        setIsSubmitting(false);
        return;
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
          console.warn("ส่ง Flex ยืนยันการจองไม่สำเร็จ:", msgError);
        }
      }

      showToast("จองห้องพักสำเร็จ!", "success");
      router.push("/my-appointments");
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง", "error");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen spinnerStyle={{ animationDuration: "3s" }} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-40">
      <div className="px-5 pt-6">
        {/* 1. Room Preview Card */}
        <div className="bg-white rounded-3xl p-4 flex gap-4 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="w-24 h-24 flex-shrink-0 rounded-2xl bg-gray-200 overflow-hidden">
            {roomType?.imageUrls?.[0] ? (
              <img src={roomType.imageUrls[0]} alt={roomType.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>
            )}
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <div className="text-xs text-gray-400 font-medium mb-0.5">Hotel Room</div>
            <h3 className="font-bold text-[#1a1a1a] text-lg truncate mb-1">{roomType?.name}</h3>
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              <span className="text-xs font-bold text-[#1a1a1a]">4.9</span>
              <span className="text-[10px] text-gray-400">(100+ Reviews)</span>
            </div>
          </div>
        </div>

        {/* 2. Your Booking */}
        <h3 className="text-sm font-bold text-[#1a1a1a] mb-3 px-1">Your Booking</h3>
        <div className="bg-white rounded-3xl p-5 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4 border border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Dates</p>
              <p className="font-bold text-[#1a1a1a] text-sm">{formatDate(checkIn)} - {formatDate(checkOut)}</p>
            </div>
            <button onClick={handleEditSearch} className="flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Edit
            </button>
          </div>
          <div className="w-full h-px bg-gray-100"></div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Guests</p>
              <p className="font-bold text-[#1a1a1a] text-sm">{guests} Guests ({roomsCount} Rooms)</p>
            </div>
            <button onClick={handleEditSearch} className="flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Edit
            </button>
          </div>
          <div className="w-full h-px bg-gray-100"></div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Contact</p>
              <p className="font-bold text-[#1a1a1a] text-sm">{fullName}</p>
            </div>
            <button onClick={handleBackToGuestInfo} className="flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Edit
            </button>
          </div>
        </div>

        {/* 3. Payment Information */}
        <h3 className="text-sm font-bold text-[#1a1a1a] mb-3 px-1">Payment Information</h3>
        <div className="bg-white rounded-3xl p-5 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Cost</p>
              <div className="flex items-baseline gap-2">
                {discountAmount > 0 && <span className="text-gray-400 line-through text-sm font-medium">{originalTotalPrice.toLocaleString()}</span>}
                <p className="font-bold text-[#1a1a1a] text-2xl">{finalTotalPrice.toLocaleString()} {roomType?.currencySymbol || "฿"}</p>
              </div>
            </div>
            {/* Coupon Toggle */}
            <button
              onClick={() => setShowCoupon(prev => !prev)}
              className="text-xs font-bold text-[#ff7a3d] bg-[#ff7a3d]/10 px-3 py-1.5 rounded-full hover:bg-[#ff7a3d]/20 transition-colors"
            >
              {selectedCoupon ? 'Change Coupon' : 'Add Coupon'}
            </button>
          </div>

          {/* Coupon List (Collapsible) */}
          {showCoupon && (
            <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in-down">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Available Coupons</p>
              <div className="space-y-2">
                {availableCoupons.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No coupons available</p>
                ) : (
                  availableCoupons.map(coupon => (
                    <div
                      key={coupon.id}
                      onClick={() => setSelectedCouponId(selectedCouponId === coupon.id ? '' : coupon.id)}
                      className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${selectedCouponId === coupon.id ? 'border-[#ff7a3d] bg-[#ff7a3d]/5' : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <div>
                        <p className="text-sm font-bold text-[#1a1a1a]">{coupon.name}</p>
                        <p className="text-[10px] text-gray-500">Discount {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue}฿`}</p>
                      </div>
                      {selectedCouponId === coupon.id && <div className="w-4 h-4 rounded-full bg-[#ff7a3d] flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 z-50">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xl font-bold text-[#1a1a1a] flex items-baseline gap-1">
              {finalTotalPrice.toLocaleString()}
              <span className="text-sm font-bold text-[#1a1a1a]">{roomType?.currencySymbol || "฿"}</span>
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Includes taxes and fees</p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-[#1a1a1a] hover:bg-black text-white px-8 py-3.5 rounded-2xl font-bold text-base shadow-lg transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:transform-none min-w-[150px]"
          >
            {isSubmitting ? "Processing" : "Continue"}
          </button>
        </div>
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
