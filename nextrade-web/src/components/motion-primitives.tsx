"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * ScrollReveal — GPU-accelerated viewport entrance (Staging, Slow In/Out, No Scroll-Jacking).
 * Triggers once when entering the viewport and respects prefers-reduced-motion.
 */
export function ScrollReveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`tg-reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * TiltCard — Tasteful Solid Drawing in 3D + Secondary Action spotlight.
 * Subtle <= 3.5deg perspective tilt on pointer hover; disabled on touch and reduced-motion.
 */
export function TiltCard({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(1, rect.width);
    const py = (e.clientY - rect.top) / Math.max(1, rect.height);
    const rotateY = (px - 0.5) * 6;
    const rotateX = (0.5 - py) * 6;
    el.style.setProperty("--tilt-rx", `${rotateX.toFixed(2)}deg`);
    el.style.setProperty("--tilt-ry", `${rotateY.toFixed(2)}deg`);
    el.style.setProperty("--spot-x", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--spot-y", `${(py * 100).toFixed(1)}%`);
  }

  function handlePointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-rx", "0deg");
    el.style.setProperty("--tilt-ry", "0deg");
  }

  return (
    <div
      ref={ref}
      className={`tg-tilt-card${className ? ` ${className}` : ""}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/**
 * ViewTransition — Snappy Pose-to-Pose page/view transition wrapper without blocking interaction.
 */
export function ViewTransition({
  viewKey,
  children,
}: {
  viewKey: string;
  children: ReactNode;
}) {
  return (
    <div key={viewKey} className="tg-view-transition">
      {children}
    </div>
  );
}
