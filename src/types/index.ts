export interface ServiceOption {
    name: string;
    price: number;
    duration: number;
}

export interface AddOnService {
    name: string;
    price: number;
    duration: number;
}

export interface AreaOption {
    name: string;
    price?: number;
    duration?: number;
}

export interface MultiArea {
    name: string;
    price?: number;
    duration?: number;
    packages?: ServiceOption[];
}

export interface TechnicianInfo {
    firstName: string;
    lastName?: string;
    nickname?: string;
}

export interface AreaGroup {
    areaName: string;
    options: AreaOption[];
}

export interface Service {
    id?: string;
    name?: string;
    serviceName?: string;
    price?: number;
    duration?: number;
    description?: string;
    details?: string;
    imageUrl?: string;
    status: 'available' | 'unavailable';
    category?: string;
    serviceType?: 'single' | 'option-based' | 'area-based-options' | 'multi-area';
    serviceOptions?: ServiceOption[];
    areaOptions?: AreaGroup[];
    areas?: MultiArea[];
    selectableAreas?: string[];
    addOnServices?: AddOnService[];
    createdAt?: any;
    updatedAt?: any;
}

export interface RoomType {
    id: string;
    name: string;
    description?: string;
    basePrice?: number;
    currencySymbol?: string;
    imageUrls?: string[];
    maxGuests?: number;
    sizeSqM?: number;
    amenities?: string[];
    status?: 'available' | 'full' | 'unavailable';
    createdAt?: any;
    updatedAt?: any;
}


export interface Room {
    id: string;
    number: string;
    roomTypeId: string;
    floor?: number;
    status?: 'available' | 'occupied' | 'maintenance' | 'cleaning';
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
}
export interface Appointment {
    id: string;
    status: 'awaiting_confirmation' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'pending' | 'blocked';
    bookingType?: 'service' | 'room';
    queue?: string | number;
    queueNumber?: string | number;
    customerInfo: {
        name?: string;
        fullName?: string;
        phone?: string;
        pictureUrl?: string;
        note?: string;
    };
    serviceInfo: {
        id?: string;
        name?: string;
        imageUrl?: string;
        duration?: number;
        price?: number;
        completionNote?: string;
        // Extended properties
        serviceType?: string;
        selectedOptionName?: string;
        selectedOptionPrice?: number;
        selectedOptionDuration?: number;
        selectedAreas?: string[];
        selectedAreaOptions?: any[];
        selectedArea?: { name: string; price?: number };
        selectedPackage?: { name: string; duration?: number; price?: number };
    };
    appointmentInfo?: {
        dateTime?: any;
        duration?: number;
        addOns?: any[];
        technicianName?: string;
    };
    bookingInfo?: {
        roomTypeId?: string;
        roomId?: string | null;
        checkInDate?: string;
        checkOutDate?: string;
        nights?: number;
        rooms?: number;
        guests?: number | null;
    };
    roomTypeInfo?: {
        id?: string;
        name?: string;
        imageUrl?: string | null;
    };
    paymentInfo?: {
        basePrice?: number;
        totalPrice?: number;
        originalPrice?: number;
        amountPaid?: number;
        addOnsTotal?: number;
        discount?: number;
        couponDiscount?: number;
        paymentStatus?: 'paid' | 'unpaid' | 'invoiced' | 'pending';
        paymentMethod?: string;
        paidAt?: any;
        paymentDueAt?: any;
    };
    addOns?: any[];
    date?: any;
    time?: string;
    dateTime?: any;
    userId?: string;
    completionNote?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface Technician {
    id: string;
    firstName: string;
    lastName?: string;
    phoneNumber: string;
    lineUserId?: string;
    imageUrl?: string;
    status: 'available' | 'on_trip' | 'unavailable' | 'suspended';
    createdAt?: any;
    updatedAt?: any;
}

export interface Customer {
    id: string;
    fullName: string;
    phone: string;
    email?: string;
    userId?: string;
    points?: number;
    createdAt?: any;
    updatedAt?: any;
}

export interface Employee {
    id: string;
    firstName: string;
    lastName?: string;
    username: string;
    role: 'admin' | 'receptionist' | 'housekeeper' | 'manager';
    status: 'active' | 'suspended';
    createdAt?: any;
    updatedAt?: any;
}
