"use client";

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, addMonths, subMonths, isToday, isBefore } from 'date-fns';
import { th } from 'date-fns/locale';

interface FullCalendarProps {
    selectedDate: string;
    onDateSelect: (date: string) => void;
    weeklySchedule?: any;
    holidayDates?: any[];
    className?: string;
}

export default function FullCalendar({
    selectedDate,
    onDateSelect,
    weeklySchedule = {},
    holidayDates = [],
    className = ''
}: FullCalendarProps) {
    // Generate days logic
    const generateCalendarDays = (month: Date) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        const days = [];
        let day = startDate;
        while (day <= endDate) {
            days.push(new Date(day));
            day = addDays(day, 1);
        }
        return days;
    };

    const getDateStatus = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];

        if (isBefore(date, new Date().setHours(0, 0, 0, 0))) {
            return { isOpen: false, isPast: true, reason: 'ผ่านไปแล้ว' };
        }

        const specialHoliday = holidayDates.find((h: any) => h.date === dateStr);
        if (specialHoliday) {
            return { isOpen: false, isHoliday: true, reason: specialHoliday.reason || 'วันหยุด' };
        }

        if (!daySchedule || !daySchedule.isOpen) {
            return { isOpen: false, isHoliday: true, reason: 'วันหยุด' };
        }

        return { isOpen: true, openTime: daySchedule.openTime, closeTime: daySchedule.closeTime };
    };

    const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(selectedDate ? new Date(selectedDate) : new Date()));
    const days = useMemo(() => generateCalendarDays(currentMonth), [currentMonth]);
    const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    const navigateMonth = (dir: 'next' | 'prev') => {
        setCurrentMonth(prev => dir === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    return (
        <div className={`select-none bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm ${className}`}>
            {/* Gray Header */}
            <div className="bg-gray-200  px-4 py-4 flex items-center justify-between">
                <button
                    onClick={() => navigateMonth('prev')}
                    className="p-1.5 rounded-lg bg-gray-300 text-gray-900 hover:bg-gray-500 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-md font-bold text-gray-900 tracking-wide">
                    {format(currentMonth, 'MMMM yyyy', { locale: th })}
                </h2>
                <button
                    onClick={() => navigateMonth('next')}
                    className="p-1.5 rounded-lg bg-gray-300 text-gray-900 hover:bg-gray-500 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-2">
                    {dayNames.map((day, idx) => (
                        <div key={day} className={`text-center text-sm font-semibold pb-2 ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                    {days.map((day, idx) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const status = getDateStatus(day);
                        const isSelected = selectedDate === dateStr;
                        const isTodayDate = isToday(day);

                        // Style logic
                        let bgClass = "bg-transparent";
                        let textClass = "text-gray-700";
                        let cursorClass = "cursor-pointer hover:bg-gray-50";

                        if (!isCurrentMonth) {
                            textClass = "text-gray-300";
                            cursorClass = "cursor-default";
                        } else if (status.isPast) {
                            textClass = "text-gray-300";
                            cursorClass = "cursor-not-allowed";
                        } else if (status.isHoliday) {
                            bgClass = "bg-red-50";
                            textClass = "text-red-500";
                            cursorClass = "cursor-not-allowed";
                        } else if (isSelected) {
                            // Selected overrides everything else for background
                            // Actually user might want to still see if it's today logic
                        }

                        // Determine the circle styles
                        let circleClass = "w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all mb-0.5 mx-auto";

                        if (isSelected) {
                            circleClass += " bg-gray-900 text-white ring-2 ring-offset-1 ring-gray-900 shadow-md";
                        } else if (isTodayDate) {
                            circleClass += " bg-gray-200 text-gray-800 font-bold";
                        } else if (status.isHoliday && isCurrentMonth) {
                            circleClass += " text-red-500 font-bold";
                        } else if (isCurrentMonth && status.isOpen) {
                            circleClass += " text-gray-900";
                        } else {
                            circleClass += " text-gray-300";
                        }

                        const isDisabled = !isCurrentMonth || status.isPast || (!status.isOpen && !status.isHoliday); // Allow clicking holiday? No.

                        return (
                            <div
                                key={dateStr}
                                onClick={() => !isDisabled && status.isOpen && onDateSelect(dateStr)}
                                className={`
                                    flex flex-col items-center justify-start py-2 rounded-lg min-h-[70px] relative
                                    ${bgClass} ${cursorClass}
                                `}
                            >
                                {/* Today Badge */}
                                {isTodayDate && isCurrentMonth && <span className="absolute -top-1 -right-1 text-[9px] font-bold text-slate-900 bg-white border border-slate-200 px-1 rounded shadow-sm z-10">วันนี้</span>}

                                {/* Number Circle */}
                                <div className={circleClass}>
                                    {format(day, 'd')}
                                </div>

                                {/* Status Indicators */}
                                <div className="h-4 flex items-center justify-center">
                                    {isCurrentMonth && !status.isPast && (
                                        <>
                                            {status.isOpen ? (
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            ) : status.isHoliday ? (
                                                <span className="text-[10px] font-medium text-red-400">หยุด</span>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Legend Footer */}
            <div className="bg-gray-50 border-t px-6 py-3 flex gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>เปิดให้บริการ</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-200" />
                    <span>วันหยุด</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    <span>วันที่ผ่านไป</span>
                </div>
            </div>
        </div>
    );
}
