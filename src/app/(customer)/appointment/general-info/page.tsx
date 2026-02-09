"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { useProfile } from '@/context/ProfileProvider';
import { db } from '@/app/lib/firebase';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { createAppointmentWithSlotCheck, createBooking } from '@/app/actions/appointmentActions';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/Toast';
import { AddOnService, Service, ServiceOption, AreaOption, MultiArea, TechnicianInfo } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

interface Coupon {
    id: string;
    name: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    used?: boolean;
}

function GeneralInfoContent() {
    const searchParams = useSearchParams();
    const { profile, loading: liffLoading, liff } = useLiffContext();
    const { profile: shopProfile } = useProfile();
    const router = useRouter();
    const { showToast } = useToast();

    // --- Params ---
    const serviceId = searchParams.get('serviceId');
    const addOnsParam = searchParams.get('addOns');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const technicianId = searchParams.get('technicianId');
    // Booking params (room)
    const roomTypeId = searchParams.get('roomTypeId');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const roomsParam = searchParams.get('rooms');
    const nightsParam = searchParams.get('nights');
    const bookingGuestsParam = searchParams.get('guests');

    // Legacy Params (Multi-Area)
    const areaIndexParam = searchParams.get('areaIndex');
    const packageIndexParam = searchParams.get('packageIndex');
    const areaIndex = areaIndexParam ? parseInt(areaIndexParam) : null;
    const packageIndex = packageIndexParam ? parseInt(packageIndexParam) : null;

    // New Params (Option-Based)
    const selectedOptionName = searchParams.get('selectedOptionName');
    const selectedOptionPriceParam = searchParams.get('selectedOptionPrice');
    const selectedOptionDurationParam = searchParams.get('selectedOptionDuration');
    const selectedOptionPrice = selectedOptionPriceParam ? parseFloat(selectedOptionPriceParam) : 0;
    const selectedOptionDuration = selectedOptionDurationParam ? parseInt(selectedOptionDurationParam) : 0;

    const selectedAreasParam = searchParams.get('selectedAreas');
    const selectedAreas = selectedAreasParam ? selectedAreasParam.split(',') : [];

    // New Params (Area-Based-Options)
    const selectedAreaOptionsParam = searchParams.get('selectedAreaOptions');
    // Type: { [areaName: string]: number } (option index)
    const selectedAreaOptions = selectedAreaOptionsParam ? JSON.parse(selectedAreaOptionsParam) : {};

    const [formData, setFormData] = useState({ fullName: "", phone: "", email: "", note: "" });
    const [service, setService] = useState<Service | null>(null);
    const [roomType, setRoomType] = useState<any>(null);
    const [technician, setTechnician] = useState<TechnicianInfo & { id: string } | null>(null);
    const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
    const [selectedCouponId, setSelectedCouponId] = useState('');
    const [showCoupon, setShowCoupon] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedAddOns = addOnsParam ? addOnsParam.split(',') : [];
    const isRoomBooking = Boolean(roomTypeId);
    const bookingRooms = roomsParam ? Math.max(1, parseInt(roomsParam) || 1) : 1;
    const bookingNights = nightsParam
        ? Math.max(1, parseInt(nightsParam) || 1)
        : (checkIn && checkOut)
            ? Math.max(
                1,
                Math.round(
                    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24),
                ) || 1,
            )
            : 1;
    const bookingGuests = bookingGuestsParam ? parseInt(bookingGuestsParam) : undefined;
    const bookingGuestsSafe = Number.isFinite(bookingGuests) ? bookingGuests : undefined;
    const bookingTotalFromParams = Number(searchParams.get('totalPrice')) || 0;
    const bookingTotal =
        bookingTotalFromParams > 0
            ? bookingTotalFromParams
            : (roomType?.basePrice || 0) * Math.max(1, bookingRooms) * Math.max(1, bookingNights);
    const bookingCurrencySymbol = roomType?.currencySymbol || shopProfile.currencySymbol || '฿';

    const formatDate = (value: string | null) => {
        if (!value) return '-';
        const dateValue = new Date(value);
        if (Number.isNaN(dateValue.getTime())) return '-';
        return format(dateValue, 'dd/MM/yyyy', { locale: th });
    };

    useEffect(() => {
        const fetchAllData = async () => {
            // In development mock mode, profile.userId might be 'U_TEST...'
            if (liffLoading) return;
            if (!profile?.userId) {
                setLoading(false);
                return;
            }

            const shouldLoadService = Boolean(serviceId);
            const shouldLoadRoomType = Boolean(roomTypeId);

            try {
                const customerPromise = getDoc(doc(db, "customers", profile.userId));
                const servicePromise = shouldLoadService && serviceId
                    ? getDoc(doc(db, 'services', serviceId))
                    : Promise.resolve(null);
                const roomTypePromise = shouldLoadRoomType && roomTypeId
                    ? getDoc(doc(db, 'roomTypes', roomTypeId))
                    : Promise.resolve(null);
                const couponsPromise = shouldLoadService
                    ? getDocs(query(collection(db, "customers", profile.userId, "coupons"), where("used", "==", false)))
                    : Promise.resolve(null);
                const technicianPromise = shouldLoadService && technicianId && technicianId !== 'auto-assign'
                    ? getDoc(doc(db, 'technicians', technicianId))
                    : Promise.resolve(null);

                const [customerSnap, serviceSnap, roomTypeSnap, couponsSnapshot, technicianSnap] = await Promise.all([
                    customerPromise,
                    servicePromise,
                    roomTypePromise,
                    couponsPromise,
                    technicianPromise
                ]);

                if (customerSnap.exists()) {
                    const data = customerSnap.data();
                    setFormData(prev => ({ ...prev, fullName: data.fullName || profile.displayName || "", phone: data.phone || "", email: data.email || "" }));
                } else {
                    setFormData(prev => ({ ...prev, fullName: profile.displayName || "" }));
                }

                if (serviceSnap && serviceSnap.exists()) {
                    setService({ id: serviceSnap.id, ...serviceSnap.data() } as Service);
                } else {
                    setService(null);
                }

                if (roomTypeSnap && roomTypeSnap.exists()) {
                    setRoomType({ id: roomTypeSnap.id, ...roomTypeSnap.data() });
                } else {
                    setRoomType(null);
                }

                if (shouldLoadService && technicianId === 'auto-assign') {
                    setTechnician({ firstName: 'ระบบจัดให้', lastName: '', id: 'auto-assign' });
                } else if (technicianSnap && technicianSnap.exists()) {
                    setTechnician({ id: technicianSnap.id, ...technicianSnap.data() } as TechnicianInfo & { id: string });
                } else {
                    setTechnician(null);
                }

                if (couponsSnapshot) {
                    setAvailableCoupons(couponsSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })));
                } else {
                    setAvailableCoupons([]);
                }
            } catch (error) {
                console.error("Error fetching details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [liffLoading, profile?.userId, serviceId, technicianId, roomTypeId]);

    const { basePrice, addOnsTotal, totalPrice, finalPrice, discount, selectedArea, selectedPackage, totalDuration } = useMemo(() => {
        if (!service) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, finalPrice: 0, discount: 0, selectedArea: null, selectedPackage: null, totalDuration: 0 };

        let base = service.price || 0;
        let duration = service.duration || 0;
        let selectedAreaData: MultiArea | null = null;
        let selectedPackageData: ServiceOption | null = null;

        // 1. Multi-Area Logic (Legacy)
        if (service.serviceType === 'multi-area' && service.areas && service.areas.length > 0) {
            if (areaIndex !== null && service.areas[areaIndex]) {
                selectedAreaData = service.areas[areaIndex];
                base = selectedAreaData.price || 0;
                duration = selectedAreaData.duration || 0;

                if (packageIndex !== null && selectedAreaData.packages && selectedAreaData.packages[packageIndex]) {
                    selectedPackageData = selectedAreaData.packages[packageIndex];
                    base = selectedPackageData.price || 0;
                    duration = selectedPackageData.duration || 0;
                }
            }
        }
        // 2. Option-Based Logic (New)
        else if (service.serviceType === 'option-based') {
            let unitPrice = selectedOptionPrice;
            let unitDuration = selectedOptionDuration;

            // ถ้ามีข้อมูล serviceOptions ให้ลองดึงราคาล่าสุด (กันราคาเปลี่ยน)
            if (selectedOptionName && service.serviceOptions) {
                const option = service.serviceOptions.find(o => o.name === selectedOptionName);
                if (option) {
                    unitPrice = option.price;
                    unitDuration = option.duration;
                }
            }

            // สูตร: ราคาต่อหน่วย x จำนวนจุด
            const areaCount = Math.max(1, selectedAreas.length);
            base = unitPrice * areaCount;
            duration = unitDuration * areaCount;
        }
        // 3. Area-Based-Options Logic (Newest)
        else if (service.serviceType === 'area-based-options') {
            base = 0;
            duration = 0;
            Object.entries(selectedAreaOptions).forEach(([areaName, optIdx]) => {
                const optIndex = optIdx as number;
                const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                if (areaGroup && areaGroup.options[optIndex]) {
                    base += Number(areaGroup.options[optIndex].price) || 0;
                    duration += Number(areaGroup.options[optIndex].duration) || 0;
                }
            });
        }

        const addOnsPrice = (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).reduce((sum, a) => sum + (a.price || 0), 0);
        const addOnsDuration = (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).reduce((sum, a) => sum + (a.duration || 0), 0);
        const total = base + addOnsPrice;
        const selectedCoupon = availableCoupons.find(c => c.id === selectedCouponId);

        let discountAmount = 0;
        if (selectedCoupon) {
            discountAmount = selectedCoupon.discountType === 'percentage' ? Math.round(total * (selectedCoupon.discountValue / 100)) : selectedCoupon.discountValue;
            discountAmount = Math.min(discountAmount, total);
        }

        return {
            basePrice: base,
            addOnsTotal: addOnsPrice,
            totalPrice: total,
            finalPrice: Math.max(0, total - discountAmount),
            discount: discountAmount,
            selectedArea: selectedAreaData,
            selectedPackage: selectedPackageData,
            totalDuration: duration + addOnsDuration
        };
    }, [service, selectedAddOns, selectedCouponId, availableCoupons, areaIndex, packageIndex, selectedOptionName, selectedOptionPrice, selectedOptionDuration, selectedAreas, selectedAreaOptions]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Simple validation visualization
        const fullNameInput = document.querySelector('input[name="fullName"]') as HTMLInputElement;
        const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement;

        if (!formData.fullName || !formData.phone) {
            showToast("กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์", "warning");
            if (!formData.fullName && fullNameInput) fullNameInput.focus();
            else if (!formData.phone && phoneInput) phoneInput.focus();
            return;
        }

        if (liffLoading || !profile?.userId) {
            showToast('กรุณาเข้าสู่ระบบก่อนทำการจอง', "warning");
            return;
        }

        // If roomTypeId param exists, handle as room booking
        if (roomTypeId) {
            setIsSubmitting(true);
            try {
                const bookingData: any = {
                    roomTypeId,
                    checkInDate: checkIn,
                    checkOutDate: checkOut,
                    nights: bookingNights,
                    rooms: bookingRooms,
                    guests: bookingGuestsSafe,
                    status: 'awaiting_confirmation',
                    customerInfo: {
                        ...formData,
                        pictureUrl: profile.pictureUrl || ''
                    },
                    paymentInfo: {
                        totalPrice: bookingTotal,
                        paymentStatus: 'unpaid'
                    }
                };

                const lineAccessToken = liff?.getAccessToken?.();
                const result = await createBooking(bookingData, { lineAccessToken });

                if (!result.success) {
                    showToast(typeof result.error === 'string' ? result.error : "เกิดข้อผิดพลาด", "error");
                    setIsSubmitting(false);
                    return;
                }

                showToast('จองห้องพักสำเร็จ!', "success");
                router.push('/my-appointments');
            } catch (err) {
                showToast('เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง', "error");
                console.error(err);
            } finally {
                setIsSubmitting(false);
            }

            return;
        }

        if (!service) return; // Should not happen if loaded

        setIsSubmitting(true);
        try {
            const appointmentData = {
                userId: profile.userId,
                userInfo: { displayName: profile.displayName || '', pictureUrl: profile.pictureUrl || '' },
                status: 'awaiting_confirmation',
                customerInfo: {
                    ...formData,
                    pictureUrl: profile.pictureUrl || ''
                },
                serviceInfo: {
                    id: serviceId,
                    name: service.serviceName,
                    imageUrl: service.imageUrl || '',
                    serviceType: service.serviceType,
                    // Multi-area
                    selectedArea: selectedArea,
                    selectedPackage: selectedPackage,
                    areaIndex: areaIndex,
                    packageIndex: packageIndex,
                    // Option-based
                    selectedOptionName: selectedOptionName || null,
                    selectedAreas: selectedAreas || [],
                    // Area-based-options
                    selectedAreaOptions: Object.entries(selectedAreaOptions).map(([areaName, optIdx]) => {
                        const optIndex = optIdx as number;
                        const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                        const opt = areaGroup?.options[optIndex];
                        return {
                            areaName,
                            optionName: opt?.name,
                            price: opt?.price,
                            duration: opt?.duration
                        };
                    })
                },
                date: date,
                time: time,
                serviceId: serviceId,
                technicianId: technicianId,
                appointmentInfo: {
                    technicianId: technicianId,
                    employeeId: technicianId,
                    technicianInfo: { firstName: technician?.firstName, lastName: technician?.lastName },
                    dateTime: new Date(`${date}T${time}`),
                    addOns: (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)),
                    duration: totalDuration,
                    // Multi-area
                    selectedArea: selectedArea,
                    selectedPackage: selectedPackage,
                    areaIndex: areaIndex,
                    packageIndex: packageIndex,
                    // Option-based
                    selectedOptionName: selectedOptionName || null,
                    selectedAreas: selectedAreas || [],
                    // Area-based-options
                    selectedAreaOptions: Object.entries(selectedAreaOptions).map(([areaName, optIdx]) => {
                        const optIndex = optIdx as number;
                        const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                        const opt = areaGroup?.options[optIndex];
                        return {
                            areaName,
                            optionName: opt?.name,
                            price: opt?.price,
                            duration: opt?.duration
                        };
                    })
                },
                paymentInfo: {
                    basePrice,
                    addOnsTotal,
                    originalPrice: totalPrice,
                    totalPrice: finalPrice,
                    discount: discount,
                    couponId: selectedCouponId || null,
                    couponName: availableCoupons.find(c => c.id === selectedCouponId)?.name || null,
                    paymentStatus: 'unpaid',
                },
            };

            const lineAccessToken = liff?.getAccessToken?.();
            const result = await createAppointmentWithSlotCheck(appointmentData, { lineAccessToken });

            if (!result.success) {
                showToast(typeof result.error === 'string' ? result.error : "เกิดข้อผิดพลาด", "error");
                setIsSubmitting(false);
                return;
            }

            showToast('จองสำเร็จ! กำลังพาไปหน้านัดหมาย', "success");
            router.push('/my-appointments');

        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง', "error");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
            </div>
        );
    }

    return (
        <div>
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            <div className="px-6 py-2 pb-20">
                {isRoomBooking ? (
                    <div className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm">
                        <div className="p-4 text-black">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-600">เช็คอิน</span>
                                <span className="text-sm font-semibold text-gray-900">{formatDate(checkIn)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-600">เช็คเอาท์</span>
                                <span className="text-sm font-semibold text-gray-900">{formatDate(checkOut)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600">จำนวนคืน</span>
                                <span className="text-sm font-semibold text-gray-900">{bookingNights} คืน</span>
                            </div>
                        </div>
                        <div className="p-4 text-black border-t border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-medium text-gray-600 pt-0.5">ประเภทห้อง</span>
                                <div className="text-right flex-1 pl-4">
                                    <div className="text-sm font-bold text-gray-900">{roomType?.name || '-'}</div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        ราคา/คืน {Number(roomType?.basePrice || 0).toLocaleString()} {bookingCurrencySymbol}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-600">จำนวนห้อง</span>
                                <span className="text-sm font-semibold text-gray-900">{bookingRooms}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600">ผู้เข้าพัก</span>
                                <span className="text-sm font-semibold text-gray-900">{bookingGuestsSafe ?? '-'}</span>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-800 font-bold">ยอดสุทธิ</span>
                                <div className="text-right">
                                    <div className="text-md font-bold text-[#5D4037]">
                                        {bookingTotal.toLocaleString()} {bookingCurrencySymbol}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm">
                        <div className="p-4 text-black">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-600">วันที่</span>
                                <span className="text-sm font-semibold text-gray-900">{date ? format(new Date(date), 'dd/MM/yyyy', { locale: th }) : '-'}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-600">เวลา</span>
                                <span className="text-sm font-semibold text-gray-900">{time} น.</span>
                            </div>
                        </div>
                        <div className="p-4 text-black border-t border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-medium text-gray-600 pt-0.5">บริการ</span>
                                <div className="text-right flex-1 pl-4">
                                    <div className="text-sm font-bold text-gray-900">{service?.serviceName}</div>

                                    {/* Multi-Area Display */}
                                    {selectedArea && (
                                        <div className="text-sm text-gray-600">{selectedArea.name}</div>
                                    )}
                                    {selectedPackage && (
                                        <div className="text-sm text-gray-600">{selectedPackage.name}</div>
                                    )}

                                    {/* Option-Based Display */}
                                    {service?.serviceType === 'option-based' && (
                                        <div className="mt-1">
                                            <div className="text-sm text-gray-800 font-medium flex justify-end items-center gap-1">
                                                <span>{selectedOptionName}</span>
                                                <span className="text-xs text-gray-400">({selectedOptionPrice.toLocaleString()} {shopProfile.currencySymbol || '฿'})</span>
                                                <span>x {selectedAreas.length} จุด</span>
                                            </div>
                                            {selectedAreas.length > 0 && (
                                                <div className="text-xs text-gray-500 leading-tight mt-0.5">
                                                    ({selectedAreas.join(', ')})
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Area-Based-Options Display */}
                                    {service?.serviceType === 'area-based-options' && Object.keys(selectedAreaOptions).length > 0 && (
                                        <div className="mt-1 space-y-1">
                                            {Object.entries(selectedAreaOptions).map(([areaName, optIdx]) => {
                                                const optIndex = optIdx as number;
                                                const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                                                const opt = areaGroup?.options[optIndex];
                                                if (!opt) return null;
                                                return (
                                                    <div key={areaName} className="text-sm text-gray-600 flex justify-between items-center">
                                                        <span>{areaName} ({opt.name})</span>
                                                        <span className="text-xs text-gray-400 ml-2">{Number(opt.price).toLocaleString()} {shopProfile.currencySymbol || '฿'}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="text-sm text-gray-500 mt-1">
                                        {totalDuration} นาที | {basePrice.toLocaleString()} {shopProfile.currencySymbol || '฿'}
                                    </div>
                                </div>
                            </div>

                            {selectedAddOns.length > 0 && (
                                <div className="flex justify-between items-start mb-2 mt-3 pt-3">
                                    <span className="text-sm font-medium text-[#5D4037] pt-0.5">บริการเสริม</span>
                                    <div className="text-right flex-1 pl-4">
                                        <div className="text-sm font-semibold text-gray-800">
                                            {(service?.addOnServices || [])
                                                .filter(a => selectedAddOns.includes(a.name))
                                                .map(a => a.name).join(', ')
                                            }
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {(service?.addOnServices || [])
                                                .filter(a => selectedAddOns.includes(a.name))
                                                .reduce((sum, a) => sum + (a.duration || 0), 0)
                                            }นาที | {addOnsTotal.toLocaleString()} {shopProfile.currencySymbol || '฿'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Coupon Section */}
                        {availableCoupons.length > 0 && (
                            <div className="p-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCoupon(!showCoupon)}
                                    className="flex items-center justify-between w-full text-left text-[#5D4037] font-medium"
                                >
                                    <span>ใช้คูปอง ({availableCoupons.length} ใบ)</span>
                                    <span>{showCoupon ? '▼' : '▶'}</span>
                                </button>

                                {showCoupon && (
                                    <div className="space-y-2 mt-3 animate-fade-in-up">
                                        <div className="bg-gray-50 text-gray-800 rounded-lg p-3 border border-gray-100">
                                            <div className="flex items-center">
                                                <input
                                                    type="radio"
                                                    id="no-coupon"
                                                    name="coupon"
                                                    value=""
                                                    checked={selectedCouponId === ''}
                                                    onChange={(e) => setSelectedCouponId(e.target.value)}
                                                    className="mr-2"
                                                />
                                                <label htmlFor="no-coupon" className="text-sm w-full cursor-pointer">ไม่ใช้คูปอง</label>
                                            </div>
                                        </div>
                                        {availableCoupons.map(coupon => (
                                            <div key={coupon.id} className="bg-gray-50 text-gray-800 rounded-lg p-3 border border-gray-100">
                                                <div className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        id={coupon.id}
                                                        name="coupon"
                                                        value={coupon.id}
                                                        checked={selectedCouponId === coupon.id}
                                                        onChange={(e) => setSelectedCouponId(e.target.value)}
                                                        className="mr-2"
                                                    />
                                                    <label htmlFor={coupon.id} className="text-sm w-full cursor-pointer">
                                                        <div className="font-medium">{coupon.name}</div>
                                                        <div className="text-gray-500 text-xs">
                                                            ลด {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue} ${shopProfile.currencySymbol || '฿'}`}
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-800 font-bold">ยอดสุทธิ</span>
                                <div className="text-right">
                                    <div className="text-md font-bold text-[#5D4037]">
                                        {finalPrice.toLocaleString()} {shopProfile.currencySymbol || '฿'}
                                    </div>
                                    {discount > 0 && (
                                        <div className="text-xs text-green-600 mt-1">ประหยัด {discount.toLocaleString()} {shopProfile.currencySymbol || '฿'}</div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-0.5">รวมระยะเวลา {totalDuration} นาที</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white text-black rounded-2xl p-6 mb-6 shadow-sm border border-gray-100">
                    <label className="block text-lg text-center font-bold text-gray-800 mb-6">ข้อมูลลูกค้า</label>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-สกุล</label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5D4037] focus:border-transparent bg-gray-50 outline-none transition-all"
                                placeholder="กรอกชื่อ-นามสกุล"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์ติดต่อ</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5D4037] focus:border-transparent bg-gray-50 outline-none transition-all"
                                placeholder="กรอกเบอร์โทรศัพท์"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล (ถ้ามี)</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5D4037] focus:border-transparent bg-gray-50 outline-none transition-all"
                                placeholder="กรอกอีเมล"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ข้อความเพิ่มเติม</label>
                            <textarea
                                name="note"
                                value={formData.note}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5D4037] focus:border-transparent bg-gray-50 resize-none outline-none transition-all"
                                placeholder="เช่น แพ้ยา, ขอหมอนเพิ่ม"
                            />
                        </div>
                    </form>
                </div>

                {/* Confirm Button Fixed Bottom */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50">
                    <div className="max-w-md mx-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full bg-[#5D4037] hover:bg-[#3E2723] text-white py-3 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 transition-all transform active:scale-95 shadow-[#5D4037]/20"
                        >
                            {isSubmitting ? 'กำลังดำเนินการ...' : (isRoomBooking ? 'ยืนยันการจองห้องพัก' : 'ยืนยันการนัดหมาย')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function GeneralInfoPage() {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
                </div>
            }
        >
            <GeneralInfoContent />
        </Suspense>
    );
}


