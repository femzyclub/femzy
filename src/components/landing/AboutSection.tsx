import { HeartHandshake, Sparkles, Users } from "lucide-react";
import { BrandDots } from "@/components/brand/Logo";
import { Blob } from "@/components/doodle/Doodles";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";

const values = [
  { Icon: Users, t: "Every level welcome", d: "First game in years or training for a tournament — there's a spot for you.", bg: "bg-white" },
  { Icon: Sparkles, t: "Any sport", d: "Running, racquets, team games, wellness and more. We keep the calendar varied.", bg: "bg-fr-softblue" },
  { Icon: HeartHandshake, t: "A safe, fun space", d: "Women-led events where showing up matters more than winning.", bg: "bg-fr-softgreen" },
];

/** Who Fem Rise Club is. */
export function AboutSection() {
  return (
    <section id="about" className="relative scroll-mt-24 overflow-hidden border-y-2 border-ink bg-fr-cream py-24 lg:py-32">
      <Blob seed={29} color="#FBBE18" className="absolute -left-32 bottom-[-120px] w-[420px] opacity-80" />
      <div className="container-x relative grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <span className="eyebrow">About us</span>
          <h2 className="h-display mt-5 text-[2.4rem] sm:text-6xl">
            A club for women
            <br />
            who <span className="font-hand font-normal text-fr-blue">love to play</span>
            <BrandDots className="ml-3 align-middle" size={12} />
          </h2>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-fr-charcoal">
            Fem Rise Club brings women together through sport. We host runs, tournaments, skill workshops, wellness mornings and easy-going meetups —
            so it&apos;s always easy to find something to do, and someone to do it with.
          </p>
        </Reveal>
        <Stagger className="grid gap-5 sm:grid-cols-2">
          {values.map(({ Icon, t, d, bg }, i) => (
            <StaggerItem key={t} className={i === 0 ? "sm:col-span-2" : undefined}>
              <div className={`card-pop h-full p-6 ${bg}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-fr-yellow">
                  <Icon className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold">{t}</h3>
                <p className="mt-1.5 text-[15px] text-fr-charcoal">{d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
