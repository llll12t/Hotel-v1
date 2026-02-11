"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import { db } from "@/app/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useLiffContext } from "@/context/LiffProvider";
import { th } from 'date-fns/locale';

interface Coupon {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  used?: boolean;
}

export default function SelectDateTimePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading: liffLoading } = useLiffContext();

  const roomTypeId = searchParams.get("roomTypeId");
  const incomingCheckIn = searchParams.get("checkIn");
  const incomingCheckOut = searchParams.get("checkOut");
  const incomingGuests = searchParams.get("guests");

  const [loading, setLoading] = useState(true);
  const [roomType, setRoomType] = useState<any>(null);

  // Selection State
  const [checkIn, setCheckIn] = useState(
    incomingCheckIn || format(new Date(), "yyyy-MM-dd"),
  );
  const [checkOut, setCheckOut] = useState(
    incomingCheckOut || format(addDays(new Date(), 1), "yyyy-MM-dd"),
  );
  const [guests, setGuests] = useState(Number(incomingGuests) || 2);
  const [roomsCount, setRoomsCount] = useState(1);

  // Coupon State
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);

  const checkInRef = useRef<HTMLInputElement>(null);
  const checkOutRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!roomTypeId) {
        router.push("/appointment");
        return;
      }
      setLoading(true);
      try {
        // Fetch Room Type
        const docRef = doc(db, "roomTypes", roomTypeId);
        const snap = await getDoc(docRef);
        if (snap.exists()) setRoomType({ id: snap.id, ...snap.data() });
        else {
          router.push("/appointment");
          return;
        }

        // Fetch Coupons if user logged in
        if (profile?.userId) {
          const couponsQ = query(collection(db, "customers", profile.userId, "coupons"), where("used", "==", false));
          const couponsSnap = await getDocs(couponsQ);
          setAvailableCoupons(couponsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Coupon[]);
        }

      } catch (error) {
        console.error("Error loading data", error);
      } finally {
        setLoading(false);
      }
    };
    if (!liffLoading) {
      fetchData();
    }
  }, [roomTypeId, router, profile, liffLoading]);

  // Calculations
  const nights = Math.max(1, differenceInCalendarDays(new Date(checkOut), new Date(checkIn)) || 1);
  const basePrice = roomType?.basePrice || 0;
  const originalTotalPrice = basePrice * nights * Math.max(1, roomsCount); // Price before discount

  // Discount Calculation
  const selectedCoupon = availableCoupons.find(c => c.id === selectedCouponId);
  let discountAmount = 0;
  if (selectedCoupon) {
    discountAmount = selectedCoupon.discountType === 'percentage'
      ? Math.round(originalTotalPrice * (selectedCoupon.discountValue / 100))
      : selectedCoupon.discountValue;
    discountAmount = Math.min(discountAmount, originalTotalPrice);
  }
  const finalTotalPrice = Math.max(0, originalTotalPrice - discountAmount);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: th });
    } catch (e) {
      return dateStr;
    }
  };

  const handleConfirm = () => {
    const params = new URLSearchParams();
    params.set("roomTypeId", roomTypeId || "");
    params.set("checkIn", checkIn);
    params.set("checkOut", checkOut);
    params.set("guests", String(guests));
    params.set("rooms", String(roomsCount));
    params.set("nights", String(nights));

    // Pass financial info
    params.set("totalPrice", String(finalTotalPrice));
    params.set("originalPrice", String(originalTotalPrice));
    params.set("discount", String(discountAmount));
    if (selectedCouponId) {
      params.set("couponId", selectedCouponId);
    }

    router.push(`/appointment/general-info?${params.toString()}`);
  };

  if (loading) {
    return (
      <LoadingScreen spinnerStyle={{ animationDuration: "3s" }} />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] pb-32">
      <div className="mx-auto max-w-lg space-y-4 p-4">

        {/* Input Section */}
        <div className="rounded-2xl bg-[var(--card)] p-4 shadow-sm border border-[var(--border)]">
          <h2 className="mb-3 text-lg font-bold text-[var(--text)]">รายละเอียดการเข้าพัก</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg cursor-not-allowed opacity-80">
              <label className="text-xs text-[var(--text-muted)]">เช็คอิน (Check-in)</label>
              <input
                disabled
                type="date"
                value={checkIn}
                className="w-full rounded-lg border border-[var(--border)] bg-gray-50 p-2 text-[var(--text-muted)] shadow-sm focus:outline-none font-medium cursor-not-allowed appearance-none"
              />
            </div>
            <div className="bg-gray-50 rounded-lg cursor-not-allowed opacity-80">
              <label className="text-xs text-[var(--text-muted)]">เช็คเอาท์ (Check-out)</label>
              <input
                disabled
                type="date"
                value={checkOut}
                className="w-full rounded-lg border border-[var(--border)] bg-gray-50 p-2 text-[var(--text-muted)] shadow-sm focus:outline-none font-medium cursor-not-allowed appearance-none"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-muted)]">ผู้เข้าพัก (Guests)</label>
              <input
                type="number"
                min={1}
                value={guests}
                onChange={(event) => setGuests(Number(event.target.value))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--text)] shadow-sm focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)]">จำนวนห้อง (Rooms)</label>
              <input
                type="number"
                min={1}
                value={roomsCount}
                onChange={(event) => setRoomsCount(Math.max(1, Number(event.target.value)))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--text)] shadow-sm focus:border-[var(--primary)] focus:outline-none bg-blue-50/50"
              />
            </div>
          </div>
        </div>

        {/* Summary Section matching user request */}
        <div className="rounded-2xl bg-[var(--card)] overflow-hidden shadow-sm border border-[var(--border)]">
          <div className="p-4 space-y-3">
            {/* Dates & Nights */}
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

            {/* Room Info */}
            <div className="flex justify-between items-start">
              <span className="text-[var(--text-muted)] text-sm">ประเภทห้อง</span>
              <div className="text-right">
                <div className="font-bold">{roomType?.name}</div>
                <div className="text-xs text-[var(--text-muted)]">ราคา/คืน/ห้อง {basePrice.toLocaleString()} {roomType?.currencySymbol || "฿"}</div>
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

          {/* Total Section */}
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

        {/* Coupon Section */}
        <div className="bg-[var(--card)] rounded-2xl p-4 shadow-sm border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setShowCoupon(v => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">คูปองส่วนลด</div>
              <div className="text-xs text-[var(--text-muted)]">{availableCoupons.length} ใบ</div>
            </div>
            <span className="text-xs text-[var(--primary)] font-medium">{showCoupon ? 'ซ่อน' : 'เลือก'}</span>
          </button>

          {showCoupon && (
            <div className="mt-4 space-y-2">
              <label className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm cursor-pointer transition-colors ${selectedCouponId === '' ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] bg-[var(--background)]'}`}>
                <input
                  type="radio"
                  name="coupon"
                  value=""
                  checked={selectedCouponId === ''}
                  onChange={(e) => setSelectedCouponId(e.target.value)}
                  className="accent-[var(--primary)] w-4 h-4"
                />
                <span className="flex-1 font-medium">ไม่ใช้คูปอง</span>
              </label>

              {availableCoupons.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)] p-2 text-center bg-gray-50 rounded-lg">ไม่มีคูปองสำหรับใช้</div>
              ) : (
                availableCoupons.map(coupon => (
                  <label
                    key={coupon.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm cursor-pointer transition-colors ${selectedCouponId === coupon.id ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)] bg-[var(--background)]'}`}
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
                        ลด {coupon.discountType === 'percentage'
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

      {/* Footer Button */}
      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="mx-auto max-w-md pt-2">
          <button
            onClick={handleConfirm}
            className="w-full rounded-xl bg-[var(--primary)] py-3 font-bold text-white shadow-lg transition-all transform active:scale-95 hover:bg-[var(--primary-dark)]"
          >
            ดำเนินการต่อ
          </button>
        </div>
      </div>
    </div>
  );
}
