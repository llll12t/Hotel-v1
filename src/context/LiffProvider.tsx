"use client";

import { createContext, useContext, ReactNode } from 'react';
import useLiff from '@/hooks/useLiff';

interface LiffContextType {
    liff: any;
    profile: any;
    loading: boolean;
    error: string;
}

const LiffContext = createContext<LiffContextType | null>(null);

export const useLiffContext = () => {
    const context = useContext(LiffContext);
    if (!context) {
        // Return a default mock state to avoid crashes if provider is missing, or throw error
        // For development safety, let's returning a safe default or throw
        throw new Error('useLiffContext must be used within LiffProvider');
    }
    return context;
};

interface LiffProviderProps {
    children: ReactNode;
    liffId?: string;
}

export const LiffProvider: React.FC<LiffProviderProps> = ({ children, liffId }) => {
    const liffData = useLiff(liffId);
    return (
        <LiffContext.Provider value={liffData}>
            {children}
        </LiffContext.Provider>
    );
};
