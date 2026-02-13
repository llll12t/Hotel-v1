"use client";

interface TimeSlotGridProps {
    timeSlots: string[];
    selectedTime: string;
    onSelect: (time: string) => void;
    isDisabled?: boolean;
}

export default function TimeSlotGrid({ timeSlots, selectedTime, onSelect, isDisabled = false }: TimeSlotGridProps) {
    if (timeSlots.length === 0) {
        return (
            <div className="text-center text-gray-400 py-8 border-2 border-dashed border-gray-100 rounded-lg">
                ไม่พบช่วงเวลาว่าง
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {timeSlots.map(time => {
                const isSelected = selectedTime === time;
                return (
                    <button
                        key={time}
                        type="button"
                        onClick={() => onSelect(time)}
                        disabled={isDisabled}
                        className={`
                            group relative px-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border
                            ${isSelected
                                ? 'bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-offset-1 ring-gray-900'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }
                        `}
                    >
                        {time} น.
                    </button>
                );
            })}
        </div>
    );
}
