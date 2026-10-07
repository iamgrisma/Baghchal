import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Native Android Vector Graphic for Tiger (Bagh)
 * Clean, geometric, sharp predator crest with high-contrast stripes.
 */
export const TigerIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Outer head contour with alert ears */}
    <path
      d="M3.8 8.8C2.6 5.2 5.2 3.6 7.8 5.6L8.8 6.9C9.8 6.5 10.9 6.2 12 6.2C13.1 6.2 14.2 6.5 15.2 6.9L16.2 5.6C18.8 3.6 21.4 5.2 20.2 8.8C21.6 11.6 21.2 15.4 18.8 17.8C16.8 19.8 14.4 20.8 12 20.8C9.6 20.8 7.2 19.8 5.2 17.8C2.8 15.4 2.4 11.6 3.8 8.8Z"
      fill="currentColor"
    />
    {/* Inner ear contrasts */}
    <path d="M5.5 6.5L7 7.8" stroke="#1c1917" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M18.5 6.5L17 7.8" stroke="#1c1917" strokeWidth="1.2" strokeLinecap="round" />
    {/* Forehead & cheek tiger stripes */}
    <path
      d="M12 7.8V10.8M9.6 8.8L11.2 11.2M14.4 8.8L12.8 11.2M6.8 13.2L9.8 13.8M17.2 13.2L14.2 13.8M10.2 16.5L12 18L13.8 16.5"
      stroke="#1c1917"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Glowing piercing eyes */}
    <circle cx="8.2" cy="12.2" r="1.1" fill="#fef08a" />
    <circle cx="15.8" cy="12.2" r="1.1" fill="#fef08a" />
    <circle cx="8.2" cy="12.2" r="0.5" fill="#1c1917" />
    <circle cx="15.8" cy="12.2" r="0.5" fill="#1c1917" />
  </svg>
);

/**
 * Native Android Vector Graphic for Goat (Bakhra)
 * Refined mountain goat profile with signature curved horns and alert eyes.
 */
export const GoatIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Curved protective horns */}
    <path
      d="M7.2 7.8C5.4 3.4 9.2 1.8 11 5.4M16.8 7.8C18.6 3.4 14.8 1.8 13 5.4"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    {/* Goat head base */}
    <path
      d="M7.4 8.6C5.8 9.6 5.2 12.2 6.8 13.8L9.2 18.8C10 20.2 11 20.8 12 20.8C13 20.8 14 20.2 14.8 18.8L17.2 13.8C18.8 12.2 18.2 9.6 16.6 8.6C14.6 7.6 9.4 7.6 7.4 8.6Z"
      fill="currentColor"
    />
    {/* Eyes and subtle facial contours */}
    <circle cx="8.8" cy="11.8" r="1.1" fill="#0f172a" />
    <circle cx="15.2" cy="11.8" r="1.1" fill="#0f172a" />
    <circle cx="9" cy="11.6" r="0.4" fill="#ffffff" />
    <circle cx="15.4" cy="11.6" r="0.4" fill="#ffffff" />
    {/* Muzzle */}
    <path
      d="M10.2 16.8C11.4 17.6 12.6 17.6 13.8 16.8"
      stroke="#334155"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);
