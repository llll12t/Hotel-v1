"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { db } from "@/app/lib/firebase";
import { useLiffContext } from "@/context/LiffProvider";
import { useToast } from "@/app/components/Toast";
import LoadingScreen from "@/app/components/common/LoadingScreen";
import { RoomType } from "@/types";

function GuestInfoContent() {
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
          const roomTypeData = roomTypeSnap.data() as Omit<RoomType, "id">;
          setRoomType({ id: roomTypeSnap.id, ...roomTypeData });
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
    return format(dateValue, "dd MMM yyyy", { locale: th });
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
    <div className="min-h-screen bg-[#f8f9fa] pb-32">
      <div className="p-4">
        {/* Summary Card */}
        <div className="bg-white rounded-xl p-5 mb-4 border border-gray-100">
          <h3 className="font-bold text-[#1a1a1a] text-lg mb-3">{roomType?.name}</h3>

          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-50 text-[#ff7a3d] px-3 py-1.5 rounded-xl text-xs font-bold">
              {bookingNights} Nights
            </div>
            <div className="bg-gray-50 text-gray-500 px-3 py-1.5 rounded-xl text-xs font-bold">
              {bookingGuestsSafe} Guests
            </div>
          </div>

          <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-3">
            <span className="text-gray-400">Check-in</span>
            <span className="font-semibold text-gray-800">{formatDate(checkIn)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="text-gray-400">Check-out</span>
            <span className="font-semibold text-gray-800">{formatDate(checkOut)}</span>
          </div>
        </div>

        {/* Form Section */}
        <h2 className="text-xl font-bold text-[#1a1a1a] mb-4 px-1">Your Details</h2>
        <div className="bg-white rounded-xl p-5  border border-gray-100 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-3.5 bg-gray-50 border-0 rounded-2xl text-[#1a1a1a] font-medium focus:ring-2 focus:ring-[#1a1a1a] outline-none transition-all placeholder-gray-300"
              placeholder="Ex. John Doe"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3.5 bg-gray-50 border-0 rounded-2xl text-[#1a1a1a] font-medium focus:ring-2 focus:ring-[#1a1a1a] outline-none transition-all placeholder-gray-300"
                placeholder="Ex. 0812345678"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Email (Optional)</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3.5 bg-gray-50 border-0 rounded-2xl text-[#1a1a1a] font-medium focus:ring-2 focus:ring-[#1a1a1a] outline-none transition-all placeholder-gray-300"
                placeholder="Ex. john@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Special Request</label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3.5 bg-gray-50 border-0 rounded-2xl text-[#1a1a1a] font-medium focus:ring-2 focus:ring-[#1a1a1a] outline-none transition-all resize-none placeholder-gray-300"
              placeholder="Any special requests..."
            />
          </div>
        </div>
      </div>

      {/* Bottom Bar (Fixed) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-50 rounded-t-[24px] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleContinue}
            disabled={isSubmitting}
            className="w-full bg-[#232227] hover:bg-black text-white px-8 py-4 rounded-2xl font-bold text-base shadow-lg transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:transform-none"
          >
            {isSubmitting ? "Processing..." : "Review & Pay"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GuestInfoPage() {
  return (
    <Suspense fallback={<LoadingScreen spinnerStyle={{ animationDuration: "3s" }} />}>
      <GuestInfoContent />
    </Suspense>
  );
}
