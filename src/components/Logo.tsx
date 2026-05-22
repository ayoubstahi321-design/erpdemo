
import React from 'react';

interface LogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export const Logo = ({ className = "h-12", showSubtitle = true }: LogoProps) => {
  return (
    <svg className={className} viewBox="0 0 320 70" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      {/* Cube/Box Icon */}
      <g transform="translate(8, 8)">
        {/* Top face */}
        <polygon points="27,4 50,16 27,28 4,16" fill="#2563eb" />
        {/* Left face */}
        <polygon points="4,16 27,28 27,52 4,40" fill="#1d4ed8" />
        {/* Right face */}
        <polygon points="50,16 27,28 27,52 50,40" fill="#3b82f6" />
        {/* Highlight lines */}
        <polygon points="27,4 50,16 27,28 4,16" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
      </g>

      {/* STOQLY text */}
      <text x="72" y="42" fontFamily="Inter, Arial, sans-serif" fontWeight="800" fontSize="36" fill="#1e293b" letterSpacing="-0.5">STOQLY</text>

      {/* Subtitle */}
      {showSubtitle && (
        <text x="73" y="58" fontFamily="Inter, Arial, sans-serif" fontWeight="500" fontSize="13" fill="#64748b" letterSpacing="2">ERP SYSTEM</text>
      )}
    </svg>
  );
};
