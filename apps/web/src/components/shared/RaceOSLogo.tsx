"use client";

import { memo } from "react";

const SIZES = {
  small: "text-sm",
  default: "text-lg",
  large: "text-2xl",
} as const;

export const RaceOSLogo = memo(function RaceOSLogo({
  size = "default",
}: {
  size?: keyof typeof SIZES;
}) {
  return (
    <span className={`font-display font-bold italic tracking-wider ${SIZES[size]}`}>
      <span className="text-white">RACEOS</span>
      <span className="text-f1-red ml-1">F1</span>
    </span>
  );
});
