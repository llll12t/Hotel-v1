"use client";

import React from 'react';

// --- Notification Component ---
interface NotificationProps {
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning';
}

export const Notification: React.FC<NotificationProps> = ({ show, title, message, type }) => {
    if (!show) return null;
    const icons = {
        success: (
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        ),
        error: (
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        ),
        warning: ( // Add warning icon fallback or specific icon
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        )
    };
    const colors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    };
    return (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 w-11/12 max-w-md p-4 rounded-lg border shadow-lg z-[9999] ${colors[type]}`}>
            <div className="flex items-start">
                <div className="flex-shrink-0">{icons[type]}</div>
                <div className="ml-3">
                    <h3 className="text-sm font-bold">{title}</h3>
                    {message && <div className="mt-1 text-sm text-balance">{message}</div>}
                </div>
            </div>
        </div>
    );
};

interface ConfirmationModalProps {
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isProcessing?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ show, title, message, onConfirm, onCancel, isProcessing }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[9999] p-4 transition-opacity">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm transform scale-100 transition-transform border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        {isProcessing ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
                    </button>
                </div>
            </div>
        </div>
    );
};
