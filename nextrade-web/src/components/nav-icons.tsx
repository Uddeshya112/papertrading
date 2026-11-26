"use client";

import type { ReactNode } from "react";

type IconProps = {
  size?: number;
  className?: string;
};

function Svg({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function NavIcon({ name, size = 16 }: { name: string; size?: number }) {
  switch (name) {
    case "Overview":
      return (
        <Svg size={size}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M9.5 20v-6h5v6" />
        </Svg>
      );
    case "Trade Terminal":
      return (
        <Svg size={size}>
          <path d="M4 17 10 11l4 4 6-8" />
          <path d="M16 7h4v4" />
          <path d="M4 20h16" />
        </Svg>
      );
    case "AI Teacher":
      return (
        <Svg size={size}>
          <path d="M22 10 12 5 2 10l10 5 10-5Z" />
          <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
        </Svg>
      );
    case "Academy":
      return (
        <Svg size={size}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </Svg>
      );
    case "Options Chain":
      return (
        <Svg size={size}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M12 4v16" />
        </Svg>
      );
    case "Basket Orders":
      return (
        <Svg size={size}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </Svg>
      );
    case "Screener":
      return (
        <Svg size={size}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
          <path d="M8 11h6" />
        </Svg>
      );
    case "Risk Center":
      return (
        <Svg size={size}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </Svg>
      );
    case "Backtesting Lab":
      return (
        <Svg size={size}>
          <path d="M9 3h6" />
          <path d="M10 3v6.5L5.2 18A2 2 0 0 0 7 21h10a2 2 0 0 0 1.8-3L14 9.5V3" />
          <path d="M8.5 14h7" />
        </Svg>
      );
    case "Portfolio":
      return (
        <Svg size={size}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <path d="M2 13h20" />
        </Svg>
      );
    case "Journal & Analytics":
      return (
        <Svg size={size}>
          <path d="M4 19h16" />
          <path d="M7 16v-5" />
          <path d="M12 16V7" />
          <path d="M17 16v-8" />
        </Svg>
      );
    case "Psychology & Challenges":
      return (
        <Svg size={size}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </Svg>
      );
    case "Reports Center":
      return (
        <Svg size={size}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h6" />
        </Svg>
      );
    case "Market Intel & Admin":
      return (
        <Svg size={size}>
          <path d="M3 12h4l3-8 4 16 3-8h4" />
        </Svg>
      );
    case "Watchlist & Alerts":
      return (
        <Svg size={size}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </Svg>
      );
    case "Profile":
      return (
        <Svg size={size}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </Svg>
      );
    case "Settings":
      return (
        <Svg size={size}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </Svg>
      );
    case "Announcement":
      return (
        <Svg size={size}>
          <path d="m3 11 18-5v12L3 13v-2Z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </Svg>
      );
    case "Bell":
      return (
        <Svg size={size}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <circle cx="12" cy="12" r="8" />
        </Svg>
      );
  }
}
