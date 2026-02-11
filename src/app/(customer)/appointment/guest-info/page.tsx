"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { db } from "@/app/lib/firebase";
import { useLiffContext } from "@/context/LiffProvider";
import { useToast } from "@/app/components/Toast";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import { RoomType } from "@/types";

export default function GuestInfoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading: liffLoading } = useLiffContext();
  const { showToast } = useToast();

  const roomTypeId = searchParams.get("roomTypeId");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const roomsParam = searchParams.get("rooms");
  const nightsParam = searchParams.get("nights");
  const guestsParam = searchParams.get("guests");
  const totalPriceParam = Number(searchParams.get("totalPrice")) || 0;
  const originalPriceParam = Number(searchParams.get("originalPrice")) || 0;
  const discountParam = Number(searchParams.get("discount")) || 0;
  const couponIdParam = searchParams.get("couponId");

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    note: "",
  });
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bookingRooms = roomsParam ? Math.max(1, Number.parseInt(roomsParam) || 1) : 1;
  const bookingNights = nightsParam ? Math.max(1, Number.parseInt(nightsParam) || 1) : 1;
  const bookingGuests = guestsParam ? Number.parseInt(guestsParam) : undefined;
  const bookingGuestsSafe = Number.isFinite(bookingGuests) ? bookingGuests : undefined;

  useEffect(() => {
    const fetchAllData = async () => {
      if (liffLoading) return;
      if (!profile?.userId) {
        setLoading(false);
        return;
      }

      try {
        const customerPromise = getDoc(doc(db, "customers", profile.userId));
        const roomTypePromise = roomTypeId
          ? getDoc(doc(db, "roomTypes", roomTypeId))
          : Promise.resolve(null);

        const [customerSnap, roomTypeSnap] = await Promise.all([
          customerPromise,
          roomTypePromise,
        ]);

        if (customerSnap.exists()) {
          const data = customerSnap.data();
          setFormData((prev) => ({
            ...prev,
            fullName: data.fullName || profile.displayName || "",
            phone: data.phone || "",
            email: data.email || "",
          }));
        } else {
          setFormData((prev) => ({ ...prev, fullName: profile.displayName || "" }));
        }

        if (roomTypeSnap && roomTypeSnap.exists()) {
          setRoomType({ id: roomTypeSnap.id, ...roomTypeSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [liffLoading, profile?.userId, profile?.displayName, roomTypeId]);

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return "-";
    return format(dateValue, "dd/MM/yyyy", { locale: th });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.phone) {
      showToast("กรุณากรอกชื่อและเบอร์โทรศัพท์", "warning");
      return;
    }

    if (liffLoading || !profile?.userId) {
      showToast("กรุณาเข้าสู่ระบบก่อนทำการจอง", "warning");
      return;
    }

    if (!roomTypeId) {
      showToast("ไม่พบข้อมูลห้องพัก", "error");
      return;
    }

    setIsSubmitting(true);
    const params = new URLSearchParams();
    params.set("roomTypeId", roomTypeId);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    params.set("guests", String(bookingGuestsSafe || 1));
    params.set("rooms", String(bookingRooms));
    params.set("nights", String(bookingNights));
    if (totalPriceParam > 0) params.set("totalPrice", String(totalPriceParam));
    if (originalPriceParam > 0) params.set("originalPrice", String(originalPriceParam));
    if (discountParam > 0) params.set("discount", String(discountParam));
    if (couponIdParam) params.set("couponId", couponIdParam);
    params.set("fullName", formData.fullName);
    params.set("phone", formData.phone);
    params.set("email", formData.email);
    params.set("note", formData.note);

    router.push(`/appointment/review-confirm?${params.toString()}`);
  };

  if (loading) {
    return <LoadingScreen spinnerStyle={{ animationDuration: "3s" }} />;
  }

  if (!roomTypeId) return null;

  return (
    <div>
      <div className="px-6 py-6 pb-20">
        <div className="bg-[var(--card)] rounded-xl p-4 mb-4 shadow-sm border border-[var(--border)]">
          <h3 className="font-bold text-[var(--text)] text-sm">{roomType?.name}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {formatDate(checkIn)} - {formatDate(checkOut)} ({bookingNights} คืน)
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {bookingRooms} ห้องพัก, ผู้เข้าพัก {bookingGuestsSafe} ท่าน
          </p>
        </div>

        <div className="bg-[var(--card)] text-[var(--text)] rounded-2xl p-6 mb-6 shadow-sm border border-[var(--border)]">
          <h2 className="text-xl font-bold text-[var(--text)] mb-2">กรอกข้อมูลผู้เข้าพัก</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">ขั้นตอนถัดไปจะเป็นสรุปรายการและชำระเงิน</p>

          <form onSubmit={handleContinue} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">ชื่อ-สกุล</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--input-bg)] outline-none transition-all"
                placeholder="กรอกชื่อ-นามสกุล"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">เบอร์ติดต่อ</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--input-bg)] outline-none transition-all"
                placeholder="กรอกเบอร์โทรศัพท์"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">อีเมล (ถ้ามี)</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--input-bg)] outline-none transition-all"
                placeholder="กรอกอีเมล"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">ข้อความเพิ่มเติม</label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-3 border border-[var(--border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--input-bg)] resize-none outline-none transition-all"
                placeholder="เช่น แพ้ยา, ขอหมอนเพิ่ม"
              />
            </div>
          </form>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] p-4 z-50">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="w-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white py-3 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 transition-all transform active:scale-95"
            >
              {isSubmitting ? "กำลังดำเนินการ..." : "ไปหน้าสรุปรายการ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
