
import React from 'react';

interface LogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export const Logo = ({ className = "h-12", showSubtitle = true }: LogoProps) => {
  return (
    <svg className={className} viewBox="0 0 420 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" direction="ltr" style={{ direction: 'ltr' }}>
      {/* SHIELD DEFINITION - Shifted to x=50 to make room for ESTD on the left */}
      <defs>
        <clipPath id="shield-clip">
          <path d="M50 5 L110 5 L110 55 C110 75 80 85 80 85 C80 85 50 75 50 55 Z" />
        </clipPath>
      </defs>

      {/* SHIELD BACKGROUND (Blue) */}
      <g clipPath="url(#shield-clip)">
        <rect x="50" y="5" width="60" height="80" fill="#00247D" />

        {/* UNION JACK - White Diagonals */}
        <path d="M50 5 L110 85" stroke="white" strokeWidth="8" />
        <path d="M110 5 L50 85" stroke="white" strokeWidth="8" />

        {/* UNION JACK - Red Diagonals */}
        <path d="M50 5 L110 85" stroke="#CF142B" strokeWidth="3" />
        <path d="M110 5 L50 85" stroke="#CF142B" strokeWidth="3" />

        {/* UNION JACK - White Cross */}
        <rect x="72" y="5" width="16" height="80" fill="white" />
        <rect x="50" y="35" width="60" height="16" fill="white" />

        {/* UNION JACK - Red Cross */}
        <rect x="76" y="5" width="8" height="80" fill="#CF142B" />
        <rect x="50" y="39" width="60" height="8" fill="#CF142B" />
      </g>

      {/* SHIELD BORDER */}
      <path d="M50 5 L110 5 L110 55 C110 75 80 85 80 85 C80 85 50 75 50 55 Z" stroke="white" strokeWidth="0" fill="none" />

      {/* ESTD. TEXT - Increased from fontSize 10 to 16 for better legibility */}
      <text x="45" y="49" textAnchor="end" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="16" fill="#00247D">ESTD.</text>

      {/* 1937 TEXT - Increased from fontSize 10 to 16 for better legibility */}
      <text x="115" y="49" textAnchor="start" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="16" fill="#00247D">1937</text>

      {/* AZMOL MAIN TEXT - Shifted right to accommodate the shield group */}
      <text x="150" y="50" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="48" fill="#CF142B" letterSpacing="-1">AZMOL</text>

      {/* BRITISH PETROCHEMICALS TEXT - Increased from fontSize 11 to 18, conditional rendering */}
      {showSubtitle && (
        <text x="151" y="72" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="18" fill="#00247D" letterSpacing="1.2">BRITISH PETROCHEMICALS</text>
      )}
    </svg>
  );
};
