import React, { useState } from "react";
import {
  motion,
  useReducedMotion,
  useAnimationControls,
} from "framer-motion";
import { Axe, Tower, Feather } from "lucide-react";

// ─── constants ────────────────────────────────────────────────────────────────

const BOOK_GLOW =
  "0 0 60px 20px rgba(139,92,246,0.4), 0 0 100px 40px rgba(234,179,8,0.2)";

const silhouettes = [
  {
    Icon: Axe,
    x: -120,
    y: -80,
    delay: 0,
    floatDelay: 0,
    label: "axe",
  },
  {
    Icon: Tower,
    x: 0,
    y: -140,
    delay: 0.08,
    floatDelay: 0.2,
    label: "tower",
  },
  {
    Icon: Feather,
    x: 120,
    y: -80,
    delay: 0.16,
    floatDelay: 0.4,
    label: "feather",
  },
];

const dotVariants = {
  idle: {
    backgroundColor: "rgb(68 64 60)",   // stone-600
    boxShadow: "0 0 0px 0px transparent",
    scale: 1,
  },
  lit: (i) => ({
    backgroundColor: "rgb(139 92 246)", // violet-500
    boxShadow: "0 0 10px 3px rgba(139,92,246,0.7)",
    scale: 1.25,
    transition: { delay: i * 0.3, duration: 0.4, ease: "easeOut" },
  }),
};

// ─── component ────────────────────────────────────────────────────────────────

export default function ForgeAndFableTeaser() {
  const prefersReduced = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const dotControls = useAnimationControls();

  // Sync dot animation with hover state
  const handleHoverStart = async () => {
    setIsHovered(true);
    if (!prefersReduced) {
      await dotControls.start((i) => dotVariants.lit(i));
    }
  };
  const handleHoverEnd = async () => {
    setIsHovered(false);
    await dotControls.start("idle");
  };

  // Shared float loop (skipped when reduced motion)
  const floatLoop = (delay) =>
    prefersReduced
      ? {}
      : {
          y: [0, -12, 0],
          opacity: [0.7, 1, 0.7],
          transition: {
            duration: 3,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
          },
        };

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-stone-950"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      {/* Wood-grain texture overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(101,67,33,0.06) 0px, rgba(101,67,33,0.06) 1px, transparent 1px, transparent 12px)",
          opacity: 1,
        }}
      />

      {/* Radial vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center gap-12">

        {/* Title */}
        <motion.h1
          className="select-none text-center font-serif text-6xl tracking-widest text-amber-100"
          initial={prefersReduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{
            textShadow: isHovered
              ? "0 0 20px rgba(234,179,8,0.8)"
              : "0 0 0px transparent",
            transition: "text-shadow 600ms ease",
            willChange: "transform, opacity",
          }}
        >
          THE FABLES
        </motion.h1>

        {/* ── Book wrapper ────────────────────────────────────────────── */}
        <motion.div
          className="relative flex cursor-pointer items-center justify-center"
          style={{ perspective: 1000, willChange: "transform" }}
          onHoverStart={handleHoverStart}
          onHoverEnd={handleHoverEnd}
        >
          {/* Floating silhouettes */}
          {silhouettes.map(({ Icon, x, y, delay, floatDelay, label }) => (
            <motion.div
              key={label}
              className="pointer-events-none absolute text-stone-300"
              style={{
                x,
                y,
                opacity: 0,
                scale: 0.5,
                willChange: "transform, opacity",
              }}
              animate={
                prefersReduced
                  ? { opacity: isHovered ? 0.8 : 0, scale: isHovered ? 1 : 0.5 }
                  : isHovered
                  ? {
                      opacity: 0.8,
                      scale: 1,
                      ...floatLoop(floatDelay),
                    }
                  : { opacity: 0, scale: 0.5 }
              }
              transition={
                prefersReduced
                  ? { duration: 0.2 }
                  : {
                      opacity: { duration: 0.5, delay, ease: "easeOut" },
                      scale: { duration: 0.5, delay, ease: "easeOut", stiffness: 200, damping: 20 },
                    }
              }
            >
              <Icon size={36} strokeWidth={1.5} />
            </motion.div>
          ))}

          {/* Book inner — preserves 3-D context */}
          <div
            style={{
              transformStyle: "preserve-3d",
              display: "flex",
              alignItems: "stretch",
              gap: 0,
              willChange: "transform",
            }}
          >
            {/* Left page */}
            <motion.div
              className="relative h-64 w-48 rounded-l-md border border-stone-600 bg-stone-800"
              style={{
                transformOrigin: "right center",
                transformStyle: "preserve-3d",
                willChange: "transform",
                boxShadow: isHovered ? BOOK_GLOW : "none",
                transition: "box-shadow 600ms ease",
              }}
              animate={
                prefersReduced
                  ? {}
                  : { rotateY: isHovered ? -25 : 0 }
              }
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Left page inner lines (decorative) */}
              <div className="absolute inset-4 flex flex-col justify-center gap-3 opacity-30">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="h-px w-full bg-amber-200" />
                ))}
              </div>
              {/* Corner flourish */}
              <div className="absolute bottom-3 right-3 text-xs text-amber-600 opacity-40 select-none">
                ❧
              </div>
            </motion.div>

            {/* Spine */}
            <div
              className="w-3 shrink-0 bg-amber-900"
              style={{
                boxShadow: isHovered
                  ? "0 0 12px 4px rgba(139,92,246,0.3)"
                  : "none",
                transition: "box-shadow 600ms ease",
              }}
            />

            {/* Right page (static) */}
            <div
              className="relative h-64 w-48 rounded-r-md border border-stone-600 bg-stone-800"
              style={{
                boxShadow: isHovered ? BOOK_GLOW : "none",
                transition: "box-shadow 600ms ease",
                willChange: "transform",
              }}
            >
              {/* Right page inner lines */}
              <div className="absolute inset-4 flex flex-col justify-center gap-3 opacity-30">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="h-px w-full bg-amber-200" />
                ))}
              </div>
              {/* Corner flourish */}
              <div className="absolute bottom-3 left-3 text-xs text-amber-600 opacity-40 select-none">
                ❧
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Narrative tracker ───────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-3 w-3 rounded-full"
                custom={i}
                animate={dotControls}
                variants={dotVariants}
                initial="idle"
                style={{ willChange: "transform, opacity" }}
              />
            ))}
          </div>
          <p className="select-none text-center text-xs tracking-widest text-stone-500">
            THE RULE OF THREE
          </p>
        </div>

      </div>
    </div>
  );
}
