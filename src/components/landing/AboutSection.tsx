import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";

const values = [
  { n: "01", t: "Every level welcome", d: "First game in years or training for a tournament — there's a spot for you." },
  { n: "02", t: "Any sport", d: "Running, racquets, team games, wellness and more. We keep the calendar varied." },
  { n: "03", t: "A safe, fun space", d: "Women-led events where showing up matters more than winning." },
];

/** Who Femzy is. */
export function AboutSection() {
  return (
    <section id="about" className="relative scroll-mt-24 overflow-hidden border-y-2 border-ink bg-fr-cream py-24 lg:py-32">
      <div className="container-x grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <span className="eyebrow">About us</span>
          <h2 className="h-display mt-5 text-[2.4rem] sm:text-6xl">
            A club for women
            <br />
            who <span className="font-hand font-normal text-fr-blue">love to play</span>
          </h2>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-fr-charcoal">
            Femzy brings women together through sport. We host runs, tournaments, skill workshops, wellness mornings and easy-going meetups —
            so it&apos;s always easy to find something to do, and someone to do it with.
          </p>
        </Reveal>
        <Stagger className="grid gap-5 sm:grid-cols-2">
          {values.map(({ n, t, d }, i) => (
            <StaggerItem key={t} className={i === 0 ? "sm:col-span-2" : undefined}>
              <div className="h-full border-l-2 border-ink px-6 py-3">
                <span className="font-display text-4xl font-bold text-fr-blue/35">{n}</span>
                <h3 className="mt-3 font-display text-xl font-bold">{t}</h3>
                <p className="mt-1.5 text-[15px] text-fr-charcoal">{d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
