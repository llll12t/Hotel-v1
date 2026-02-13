"use client";

import { useState, useMemo } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isWithinInterval,
    isBefore,
    isAfter,
    startOfDay
} from 'date-fns';
import { th } from 'date-fns/locale';

interface SimpleDateRangePickerProps {
    startDate: Date;
    endDate: Date;
    onChange: (start: Date, end: Date) => void;
    onClose: () => void;
}

export default function SimpleDateRangePicker({ startDate, endDate, onChange, onClose }: SimpleDateRangePickerProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [tempStart, setTempStart] = useState<Date | null>(startDate);
    const [tempEnd, setTempEnd] = useState<Date | null>(endDate);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    // Generate days for the current month view
    const daysInMonth = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    // Determine padding days for grid alignment
    const startDayOfWeek = startOfMonth(currentMonth).getDay(); // 0 (Sun) to 6 (Sat)
    const paddingDays = Array.from({ length: startDayOfWeek });

    const handleDayClick = (day: Date) => {
        const clickedDate = startOfDay(day);

        // Logic:
        // 1. If no start date, or both start/end selected (resetting), set start.
        // 2. If start selected but no end:
        //    - If clicked is before start, make it new start.
        //    - If clicked is after start, make it end.

        if (!tempStart || (tempStart && tempEnd)) {
            setTempStart(clickedDate);
            setTempEnd(null);
        } else if (tempStart && !tempEnd) {
            if (isBefore(clickedDate, tempStart)) {
                setTempStart(clickedDate);
            } else {
                setTempEnd(clickedDate);
                // Auto confirm is debatable, but let's let user see the selection first.
            }
        }
    };

    const handleConfirm = () => {
        if (tempStart && tempEnd) {
            onChange(tempStart, tempEnd);
        } else if (tempStart) {
            // If only start selected, default end to start + 1 day
            const nextDay = new Date(tempStart);
            nextDay.setDate(nextDay.getDate() + 1);
            onChange(tempStart, nextDay);
        }
        onClose();
    };

    const isInRange = (day: Date) => {
        if (tempStart && tempEnd) {
            return isWithinInterval(day, { start: tempStart, end: tempEnd });
        }
        if (tempStart && hoverDate && !tempEnd) {
            // Show hover preview
            if (isBefore(hoverDate, tempStart)) {
                return isWithinInterval(day, { start: hoverDate, end: tempStart });
            }
            return isWithinInterval(day, { start: tempStart, end: hoverDate });
        }
        return false;
    };

    const isStart = (day: Date) => tempStart && isSameDay(day, tempStart);
    const isEnd = (day: Date) => tempEnd && isSameDay(day, tempEnd);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
                    <h2 className="text-lg font-bold text-gray-800">เลือกวันที่เข้าพัก</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Calendar Controls */}
                <div className="flex items-center justify-between px-6 py-4">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-lg">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <span className="text-base font-semibold text-gray-800">
                        {format(currentMonth, 'MMMM yyyy', { locale: th })}
                    </span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded-lg">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Days Grid */}
                <div className="px-4 pb-2">
                    <div className="grid grid-cols-7 mb-2">
                        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                            <div key={day} className="text-center text-xs text-gray-400 font-medium py-1">
                                {day}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-4 pb-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                        {paddingDays.map((_, i) => <div key={`pad-${i}`} />)}

                        {daysInMonth.map((day) => {
                            const isSelectedStart = isStart(day);
                            const isSelectedEnd = isEnd(day);
                            const inRange = isInRange(day);
                            const isToday = isSameDay(day, new Date());
                            const disabled = isBefore(day, startOfDay(new Date())) && !isToday;

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => !disabled && handleDayClick(day)}
                                    onMouseEnter={() => !disabled && setHoverDate(day)}
                                    disabled={disabled}
                                    className={`
                                        relative h-10 w-full flex items-center justify-center text-sm font-medium rounded-lg transition-all
                                        ${disabled ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'}
                                        ${inRange && !isSelectedStart && !isSelectedEnd ? 'bg-orange-50 text-orange-900 rounded-none' : ''}
                                        ${isSelectedStart ? 'bg-[#ff7a3d] text-white rounded-r-none z-10 shadow-md' : ''}
                                        ${isSelectedEnd ? 'bg-[#ff7a3d] text-white rounded-l-none z-10 shadow-md' : ''}
                                        ${isSelectedStart && isSelectedEnd ? 'rounded-lg' : ''}
                                        ${isToday && !isSelectedStart && !isSelectedEnd ? 'border border-[#ff7a3d] text-[#ff7a3d]' : ''}
                                    `}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                        {tempStart && (
                            <span>{format(tempStart, 'dd/MM/yy')}</span>
                        )}
                        {tempStart && tempEnd && (
                            <span> - {format(tempEnd, 'dd/MM/yy')}</span>
                        )}
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={!tempStart || !tempEnd}
                        className={`
                            px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all
                            ${tempStart && tempEnd ? 'bg-[#ff7a3d] hover:bg-[#ff6a24] active:scale-95' : 'bg-gray-300 cursor-not-allowed'}
                        `}
                    >
                        ยืนยัน
                    </button>
                </div>
            </div>
        </div>
    );
}
