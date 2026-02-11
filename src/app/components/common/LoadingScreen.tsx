import React from "react";

type LoadingScreenProps = {
  className?: string;
  backgroundClassName?: string;
  spinnerClassName?: string;
  color?: string;
  spinnerStyle?: React.CSSProperties;
};

export default function LoadingScreen({
  className = "",
  backgroundClassName = "bg-[var(--background)]",
  spinnerClassName = "w-16 h-16",
  color = "var(--primary)",
  spinnerStyle,
}: LoadingScreenProps) {
  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center ${backgroundClassName} ${className}`}
    >
      <svg
        className={`animate-spin ${spinnerClassName}`}
        viewBox="0 0 24 24"
        role="status"
        aria-label="Loading"
        style={{ color, ...spinnerStyle }}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}
