"use client";

import { useState } from "react";

type InfoTipProps = {
  label: string;
  text: string;
};

/**
 * Accessible beginner-friendly "?" tooltip explaining financial terms in one plain-English sentence.
 */
export function InfoTip({ label, text }: InfoTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="tg-tip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tg-tip-btn"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open && (
        <span className="tg-tip-bubble" role="tooltip">
          <strong>{label}:</strong> {text}
        </span>
      )}
    </span>
  );
}
