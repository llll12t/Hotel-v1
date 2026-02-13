"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface StoreProfile {
    storeName?: string;
    currency?: string;
    currencySymbol?: string;
    contactPhone?: string;
    address?: string;
    description?: string;
    headerImage?: string;
    logo?: string;
}

interface ProfileContextType {
    profile: StoreProfile;
    loading: boolean;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export const useProfile = () => {
    const context = useContext(ProfileContext);
    if (!context) {
        throw new Error('useProfile must be used within a ProfileProvider');
    }
    return context;
};

interface ProfileProviderProps {
    children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
    const [profile, setProfile] = useState<StoreProfile>({
        storeName: 'กำลังโหลด...',
        currency: undefined,
        currencySymbol: undefined,
        contactPhone: '',
        address: '',
        description: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const docRef = doc(db, 'settings', 'profile');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setProfile(docSnap.data() as StoreProfile);
                } else {
                    setProfile({
                        storeName: 'ชื่อร้านค้า',
                        currency: '฿',
                        currencySymbol: 'บาท',
                        contactPhone: '',
                        address: '',
                        description: ''
                    });
                }
            } catch (error) {
                console.error("Error fetching store profile:", error);
                setProfile({
                    storeName: 'เกิดข้อผิดพลาด',
                    currency: undefined,
                    currencySymbol: undefined,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    return (
        <ProfileContext.Provider value={{ profile, loading }}>
            {children}
        </ProfileContext.Provider>
    );
};
