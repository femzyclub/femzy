"use client";

import { motion } from "framer-motion";
import { PartyPopper, Search, Ticket } from "lucide-react";
import { SectionHead } from "@/components/ui/SectionHead";
import { Arrow } from "@/components/doodle/Doodles";

const steps = [
  { n: "01", t: "Find an event", d: "Browse upcoming events or open the calendar to see what's on each day. Filter by sport, workshop or meetup.", Icon: Search, bg: "#FBBE18", rot: -2 },
  { n: "02", t: "Register online", d: "Free events take a minute. Paid ones are a quick UPI payment. No account needed — you get a registration ID instantly.", Icon: Ticket, bg: "#DCE8FF", rot: 1.5 },
  { n: "03", t: "Show up & play", d: "Bring your registration ID, meet the community and play. Then pick your next one.", Icon: PartyPopper, bg: "#E5F4DF", rot: -1 },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-24 lg:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHead eyebrow="How it works" title={<>Three steps.<br />Zero fuss.</>} />
          <p className="max-w-xs font-hand text-3xl leading-tight text-fr-blue lg:text-right">from scrolling to playing in under five minutes</p>
        </div>

        <ol className="relative mt-16 grid gap-6 md:grid-cols-3 lg:gap-10">
          {steps.map(({ n, t, d, Icon, bg, rot }, i) => (
            <motion.li
              key={n}
              initial={{ opacity: 0, y: 40, rotate: 0 }}
              whileInView={{ opacity: 1, y: 0, rotate: rot }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ type: "spring", stiffness: 130, damping: 15, delay: i * 0.1 }}
              whileHover={{ rotate: 0, y: -6 }}
              className="card-pop relative flex flex-col p-6"
              style={{ backgroundColor: bg }}
            >
              <div className="flex items-start justify-between">
                <span className="h-display text-6xl">{n}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-white">
                  <Icon className="h-5 w-5" strokeWidth={2.4} />
                </span>
              </div>
              <h3 className="mt-10 font-display text-2xl font-bold leading-tight">{t}</h3>
              <p className="mt-2 text-[15px] leading-snug text-fr-charcoal">{d}</p>
              {i < steps.length - 1 && <Arrow variant="curve" className="absolute -right-10 top-8 z-10 hidden h-8 w-12 -rotate-12 md:block" />}
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
