"use client";

import Image from 'next/image';
import { Technician } from '@/types';

interface TechnicianCardProps {
    technician: Technician;
    isSelected: boolean;
    onSelect: (technician: Technician) => void;
    isAvailable: boolean;
}

export default function TechnicianCard({ technician, isSelected, onSelect, isAvailable }: TechnicianCardProps) {
    return (
        <div
            onClick={() => isAvailable && onSelect(technician)}
            className={`
                relative flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none
                ${!isAvailable
                    ? 'opacity-50 grayscale bg-gray-50 cursor-not-allowed border-gray-200'
                    : isSelected
                        ? 'bg-gray-900 border-gray-900 text-white shadow-md transform scale-[1.01]'
                        : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-gray-900'
                }
            `}
        >
            {/* Avatar */}
            <div className={`relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ${isSelected ? 'border-gray-700' : 'border-gray-100'}`}>
                <Image
                    src={technician.imageUrl || 'https://via.placeholder.com/150'}
                    alt={technician.firstName}
                    fill
                    className="object-cover"
                    unoptimized
                />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                    {technician.firstName} {technician.lastName}
                </p>
                <p className={`text-xs truncate ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                    {isAvailable ? 'ว่าง' : 'ไม่ว่าง'}
                </p>
            </div>

            {/* Selection Indicator */}
            {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"></div>
            )}
        </div>
    );
}
