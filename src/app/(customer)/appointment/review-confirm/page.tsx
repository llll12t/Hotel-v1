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
}) => ({
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
  },
});

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
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: th });
    } catch {
      return dateStr;
    }
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
  };

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
        customerInfo: {
          fullName,
          phone,
          email,
          note,
          pictureUrl: profile.pictureUrl || "",
        },
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
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] pb-36">
      <div className="mx-auto max-w-lg space-y-4 p-4">

        <div className="rounded-2xl bg-[var(--card)] p-4 shadow-sm border border-[var(--border)]">
          <h3 className="font-semibold mb-2">ข้อมูลผู้เข้าพัก</h3>
          <div className="text-sm space-y-1 text-[var(--text-muted)]">
            <div>ชื่อ: <span className="text-[var(--text)] font-medium">{fullName || "-"}</span></div>
            <div>โทร: <span className="text-[var(--text)] font-medium">{phone || "-"}</span></div>
            <div>อีเมล: <span className="text-[var(--text)] font-medium">{email || "-"}</span></div>
            {note ? <div>หมายเหตุ: <span className="text-[var(--text)] font-medium">{note}</span></div> : null}
          </div>
          <button
            type="button"
            onClick={handleBackToGuestInfo}
            className="mt-3 text-xs font-semibold text-[var(--primary)] underline"
          >
            แก้ไขข้อมูลผู้เข้าพัก
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--card)] overflow-hidden shadow-sm border border-[var(--border)]">
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[var(--text-muted)]">เช็คอิน</span>
              <span className="font-bold">{formatDate(checkIn)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[var(--text-muted)]">เช็คเอาท์</span>
              <span className="font-bold">{formatDate(checkOut)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[var(--text-muted)]">จำนวนคืน</span>
              <span className="font-bold">{nights} คืน</span>
            </div>
            <hr className="border-[var(--border)] my-2" />
            <div className="flex justify-between items-start">
              <span className="text-[var(--text-muted)] text-sm">ประเภทห้อง</span>
              <div className="text-right">
                <div className="font-bold">{roomType?.name}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  ราคา/คืน/ห้อง {basePrice.toLocaleString()} {roomType?.currencySymbol || "฿"}
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[var(--text-muted)]">จำนวนห้อง</span>
              <span className="font-bold">{roomsCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[var(--text-muted)]">ผู้เข้าพัก</span>
              <span className="font-bold">{guests}</span>
            </div>
          </div>

          <div className="bg-[var(--background)] px-4 py-4 border-t border-[var(--border)]">
            <div className="flex justify-between items-center text-sm text-[var(--text-muted)] mb-1">
              <span>ยอดรวม</span>
              <span>{originalTotalPrice.toLocaleString()} {roomType?.currencySymbol || "฿"}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm text-[var(--success)] mb-2">
                <span>ส่วนลด</span>
                <span>-{discountAmount.toLocaleString()} {roomType?.currencySymbol || "฿"}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-2">
              <span className="text-[var(--text)] font-bold text-lg">ยอดสุทธิ</span>
              <span className="text-[var(--primary)] font-bold text-xl">
                {finalTotalPrice.toLocaleString()} {roomType?.currencySymbol || "฿"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] rounded-2xl p-4 shadow-sm border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setShowCoupon((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">คูปองส่วนลด</div>
              <div className="text-xs text-[var(--text-muted)]">{availableCoupons.length} ใบ</div>
            </div>
            <span className="text-xs text-[var(--primary)] font-medium">{showCoupon ? "ซ่อน" : "เลือก"}</span>
          </button>

          {showCoupon && (
            <div className="mt-4 space-y-2">
              <label className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm cursor-pointer transition-colors ${selectedCouponId === "" ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)] bg-[var(--background)]"}`}>
                <input
                  type="radio"
                  name="coupon"
                  value=""
                  checked={selectedCouponId === ""}
                  onChange={(e) => setSelectedCouponId(e.target.value)}
                  className="accent-[var(--primary)] w-4 h-4"
                />
                <span className="flex-1 font-medium">ไม่ใช้คูปอง</span>
              </label>

              {availableCoupons.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)] p-2 text-center bg-gray-50 rounded-lg">ไม่มีคูปองสำหรับใช้</div>
              ) : (
                availableCoupons.map((coupon) => (
                  <label
                    key={coupon.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm cursor-pointer transition-colors ${selectedCouponId === coupon.id ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)] bg-[var(--background)]"}`}
                  >
                    <input
                      type="radio"
                      name="coupon"
                      value={coupon.id}
                      checked={selectedCouponId === coupon.id}
                      onChange={(e) => setSelectedCouponId(e.target.value)}
                      className="accent-[var(--primary)] w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-[var(--text)]">{coupon.name}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        ลด{" "}
                        {coupon.discountType === "percentage"
                          ? `${coupon.discountValue}%`
                          : `${coupon.discountValue.toLocaleString()} ${roomType?.currencySymbol || "฿"}`}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="mx-auto max-w-md pt-2">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--primary)] py-3 font-bold text-white shadow-lg transition-all transform active:scale-95 hover:bg-[var(--primary-dark)] disabled:opacity-60"
          >
            {isSubmitting ? "กำลังดำเนินการ..." : "ยืนยันการจอง"}
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
