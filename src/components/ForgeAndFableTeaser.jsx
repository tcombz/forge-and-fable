import React, { useState } from "react";
import { motion } from "framer-motion";

export default function ForgeAndFableTeaser() {
  const [hovered, setHovered] = useState(false);

  const handleHoverStart = () => setHovered(true);
  const handleHoverEnd = () => setHovered(false);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-stone-950 font-serif">
      {/* Book wrapper */}
      <motion.div
        className="cursor-pointer"
        onHoverStart={handleHoverStart}
        onHoverEnd={handleHoverEnd}
      >
        {/* Left page */}
        <motion.div
          className="absolute left-0 top-0 h-64 w-48 rounded-l-md border border-stone-600 bg-stone-800 transform-origin-right transform transition-all duration-500"
          animate={hovered ? { rotateY: -25 } : { rotateY: 0 }}
          style={{ boxShadow: hovered ? "0 0 30px 10px rgba(234,179,8,0.6)" : "none" }}
        >
          <div className="absolute inset-4 flex flex-col justify-center gap-2 opacity-20">
            <div className="h-px w-full bg-amber-200" />
          </div>
          <div className="absolute bottom-2 right-2 text-xs text-amber-400 select-none">❧</div>
        </motion.div>

        {/* Right page */}
        <motion.div
          className="absolute right-0 top-0 h-64 w-48 rounded-r-md border border-stone-600 bg-stone-800 transform-origin-left transform transition-all duration-500"
          animate={hovered ? { rotateY: 25 } : { rotateY: 0 }}
          style={{ boxShadow: hovered ? "0 0 30px 10px rgba(234,179,8,0.6)" : "none" }}
        >
          <div className="absolute inset-4 flex flex-col justify-center gap-2 opacity-20">
            <div className="h-px w-full bg-amber-200" />
          </div>
          <div className="absolute bottom-2 left-2 text-xs text-amber-400 select-none">❧</div>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="absolute inset-0 flex items-center justify-center text-5xl font-extrabold text-amber-300 tracking-wide"
          animate={hovered ? { color: "#ffd700", textShadow: "0 0 15px #ffd700" } : { color: "#e8c060", textShadow: "none" }}
          transition="color 0.3s ease, text-shadow 0.3s ease"
        >
          Fables
        </motion.h1>
      </motion.div>
    </div>
  );
}
