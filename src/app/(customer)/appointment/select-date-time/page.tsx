"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CustomerHeader from "@/app/components/CustomerHeader";
import SpaFlowerIcon from "@/app/components/common/SpaFlowerIcon";
import { db } from "@/app/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { addDays, differenceInCalendarDays, format } from "date-fns";

export default function SelectDateTimePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roomTypeId = searchParams.get("roomTypeId");
  const incomingCheckIn = searchParams.get("checkIn");
  const incomingCheckOut = searchParams.get("checkOut");
  const incomingGuests = searchParams.get("guests");

  const [loading, setLoading] = useState(true);
  const [roomType, setRoomType] = useState<any>(null);
  const [checkIn, setCheckIn] = useState(
    incomingCheckIn || format(new Date(), "yyyy-MM-dd"),
  );
  const [checkOut, setCheckOut] = useState(
    incomingCheckOut || format(addDays(new Date(), 1), "yyyy-MM-dd"),
  );
  const [guests, setGuests] = useState(Number(incomingGuests) || 2);
  const [roomsCount, setRoomsCount] = useState(1);

  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomTypeId) {
        router.push("/appointment");
        return;
      }
      setLoading(true);
      try {
        const docRef = doc(db, "roomTypes", roomTypeId);
        const snap = await getDoc(docRef);
        if (snap.exists()) setRoomType({ id: snap.id, ...snap.data() });
        else router.push("/appointment");
      } catch (error) {
        console.error("Error loading room type", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomTypeId, router]);

  const nights = Math.max(
    1,
    differenceInCalendarDays(new Date(checkOut), new Date(checkIn)) || 1,
  );
  const basePrice = roomType?.basePrice || 0;
  const totalPrice = basePrice * nights * Math.max(1, roomsCount);

  const handleConfirm = () => {
    const params = new URLSearchParams();
    params.set("roomTypeId", roomTypeId || "");
    params.set("checkIn", checkIn);
    params.set("checkOut", checkOut);
    params.set("guests", String(guests));
    params.set("rooms", String(roomsCount));
    params.set("nights", String(nights));
    params.set("totalPrice", String(totalPrice));

    router.push(`/appointment/general-info?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <SpaFlowerIcon
          className="h-16 w-16 animate-spin"
          color="#553734"
          style={{ animationDuration: "3s" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader showBackButton={true} showActionButtons={false} />

      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">เลือกช่วงวันที่เข้าพัก</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">เช็คอิน</label>
              <input
                type="date"
                value={checkIn}
                onChange={(event) => {
                  setCheckIn(event.target.value);
                  if (new Date(event.target.value) >= new Date(checkOut)) {
                    setCheckOut(
                      format(
                        addDays(new Date(event.target.value), 1),
                        "yyyy-MM-dd",
                      ),
                    );
                  }
                }}
                className="w-full rounded border p-2"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">เช็คเอาท์</label>
              <input
                type="date"
                min={checkIn}
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
                className="w-full rounded border p-2"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">ผู้เข้าพัก</label>
              <input
                type="number"
                min={1}
                value={guests}
                onChange={(event) => setGuests(Number(event.target.value))}
                className="w-full rounded border p-2"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">จำนวนห้อง</label>
              <input
                type="number"
                min={1}
                value={roomsCount}
                onChange={(event) =>
                  setRoomsCount(Math.max(1, Number(event.target.value)))
                }
                className="w-full rounded border p-2"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="font-semibold">สรุปการจอง</h3>
          <div className="mt-2 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>ประเภทห้อง</span>
              <span className="font-medium">{roomType?.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span>จำนวนคืน</span>
              <span>{nights} คืน</span>
            </div>
            <div className="flex justify-between">
              <span>ราคาต่อคืน</span>
              <span>
                {(basePrice || 0).toLocaleString()}{" "}
                {roomType?.currencySymbol || "฿"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>จำนวนห้อง</span>
              <span>{roomsCount}</span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
              <span>ราคารวม</span>
              <span>
                {totalPrice.toLocaleString()} {roomType?.currencySymbol || "฿"}
              </span>
            </div>
          </div>
          <button
            onClick={handleConfirm}
            className="mt-4 w-full rounded-xl bg-[#5D4037] py-3 font-bold text-white"
          >
            กรอกข้อมูลผู้เข้าพัก
          </button>
        </div>
      </div>
    </div>
  );
}
