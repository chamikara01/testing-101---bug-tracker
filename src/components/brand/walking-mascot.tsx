"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Mascot, type MascotName } from "@/components/brand/mascot";

/**
 * The mascot walks left-to-right along a ground line and loops, à la the Chrome
 * offline dinosaur game. Reduced-motion → a single standing figure.
 */
export function WalkingMascot({ name = "search" }: { name?: MascotName }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto h-28 w-full max-w-3xl overflow-hidden">
      {/* ground line */}
      <div className="absolute inset-x-0 bottom-4 h-px bg-line" />

      {reduce ? (
        <div className="flex h-full items-end justify-center pb-4">
          <Mascot name={name} className="h-20" />
        </div>
      ) : (
        <motion.div
          className="absolute bottom-4"
          initial={{ left: "-14%" }}
          animate={{ left: ["-14%", "114%"] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "linear" }}
        >
          {/* walk bob */}
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [-1.5, 1.5, -1.5] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Mascot name={name} className="h-20" />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
