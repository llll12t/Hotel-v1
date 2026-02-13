"use client";

import React, { createContext, useContext, useState, useRef, ReactNode, useCallback, useMemo } from 'react';

// Define the shape of a Toast
export interface Toast {
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    timestamp: Date;
}

// Define the context shape
interface ToastContextType {
    showToast: (message: string, type?: Toast['type']) => void;
    markAsRead: (id: number) => void;
    markAllAsRead: () => void;
    removeToast: (id: number) => void;
    clearAllToasts: () => void;
    toasts: Toast[];
    hasUnread: boolean;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [hasUnread, setHasUnread] = useState(false);
    const toastIdRef = useRef(0);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => {
            const filtered = prev.filter(toast => toast.id !== id);
            const stillHasUnread = filtered.some(t => !t.read);
            setHasUnread(stillHasUnread);
            return filtered;
        });
    }, []);

    const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        toastIdRef.current += 1;
        const id = toastIdRef.current;
        const toast: Toast = { id, message, type, read: false, timestamp: new Date() };

        setToasts(prev => [...prev, toast]);
        setHasUnread(true);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            removeToast(id);
        }, 5000);
    }, [removeToast]);

    const markAsRead = useCallback((id: number) => {
        setToasts(prev => {
            const updated = prev.map(t => t.id === id ? { ...t, read: true } : t);
            const stillHasUnread = updated.some(t => !t.read);
            setHasUnread(stillHasUnread);
            return updated;
        });
    }, []);

    const markAllAsRead = useCallback(() => {
        setToasts(prev => prev.map(t => ({ ...t, read: true })));
        setHasUnread(false);
    }, []);

    const clearAllToasts = useCallback(() => {
        setToasts([]);
        setHasUnread(false);
    }, []);

    const contextValue = useMemo(() => ({
        showToast,
        markAsRead,
        markAllAsRead,
        removeToast,
        clearAllToasts,
        toasts,
        hasUnread
    }), [showToast, markAsRead, markAllAsRead, removeToast, clearAllToasts, toasts, hasUnread]);

    return (
        <ToastContext.Provider value={contextValue}>
            {/* Toast Overlay Component could be included here if not global */}
            {/* For now, just render children, expecting a ToastContainer elsewhere OR simply state provider */}
            {/* Actually the original JS didn't render the toast UI here, it just provided state. 
          The UI must be in layout or a separate component consuming this context. 
          Wait, looking at the layout, it wraps children in provider. 
          But where is the Toast UI rendered? 
          Usually there is a <ToastContainer /> inside the provider or layout.
          Original layout just wraps content.
          Maybe there is another component called ToastDisplay? 
          Or maybe the context is just unused state?
          
          Ah, I see `src/app/components/Toast.js` just exports Provider and Hook.
          It does NOT render UI. 
          So I'll assume usage is elsewhere or I should add a basic UI. 
          
          Update: I'll add a Basic Toast UI here to ensure it works, 
          since "showing" toast without visual is useless.
      */}
            {children}

            {/* Simple Toast UI Overlay */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
              p-4 rounded-lg shadow-lg min-w-[300px] transform transition-all duration-300
              ${toast.type === 'error' ? 'bg-red-50 text-red-900 border border-red-200' :
                                toast.type === 'success' ? 'bg-green-50 text-green-900 border border-green-200' :
                                    toast.type === 'warning' ? 'bg-yellow-50 text-yellow-900 border border-yellow-200' :
                                        'bg-white text-gray-900 border border-gray-200'}
            `}
                        onClick={() => removeToast(toast.id)}
                    >
                        <div className="flex justify-between items-start">
                            <p className="text-sm font-medium">{toast.message}</p>
                            <button onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }} className="text-gray-400 hover:text-gray-600">�</button>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
