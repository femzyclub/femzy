"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

/** Sticky bottom bar on phones so "find an event" is always one tap away. */
export function MobileExploreBar() {
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setShow(y > 640));

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-fr-warm/95 p-3 backdrop-blur-md sm:hidden"
        >
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Link href="/events" className="btn-primary w-full !py-3">
              Explore events
            </Link>
            <Link href="/events/calendar" className="btn-outline !px-5 !py-3">
              Calendar
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
