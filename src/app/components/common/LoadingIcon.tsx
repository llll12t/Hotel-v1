import React from 'react';

interface LoadingIconProps extends React.SVGProps<SVGSVGElement> {
    color?: string;
    className?: string;
}

const LoadingIcon: React.FC<LoadingIconProps> = ({ className = "w-10 h-10", color = "currentColor", ...props }) => (
    <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
    >
        <rect x="4" y="4" width="4" height="16" rx="2" fill={color} className="animate-pulse origin-center" style={{ animationDelay: '0s' }} />
        <rect x="10" y="4" width="4" height="16" rx="2" fill={color} className="animate-pulse origin-center" style={{ animationDelay: '0.2s' }} />
        <rect x="16" y="4" width="4" height="16" rx="2" fill={color} className="animate-pulse origin-center" style={{ animationDelay: '0.4s' }} />
    </svg>
);

export default LoadingIcon;
