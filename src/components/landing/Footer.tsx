import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/motion";
import { Blob, Squiggle } from "@/components/doodle/Doodles";

/** Final call-to-action + footer. Set `cta={false}` on inner pages. */
export function Footer({ cta = true }: { cta?: boolean }) {
  return (
    <footer className="relative overflow-hidden">
      {cta && (
        <div className="relative py-24 text-center lg:py-32">
          <div className="absolute left-1/2 top-1/2 w-[min(900px,130vw)] -translate-x-1/2 -translate-y-1/2">
            <Blob seed={71} color="#FBBE18" className="w-full" />
          </div>
          <Blob seed={13} color="#62B946" wobble={0.35} className="absolute bottom-6 left-[6%] hidden w-40 sm:block" />
          <Blob seed={17} color="#1748E8" wobble={0.35} className="absolute right-[8%] top-8 hidden w-32 sm:block" />
          <Reveal className="container-x relative">
            <span className="eyebrow !bg-none bg-white">Your next game is waiting</span>
            <h2 className="h-display mx-auto mt-6 max-w-4xl text-5xl sm:text-7xl lg:text-8xl">
              Pick an event.
              <br />
              <span className="font-hand font-normal">Bring a friend!</span>
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/events" burst>
                Explore events
              </ButtonLink>
              <ButtonLink href="/events/calendar" variant="outline" className="bg-white">
                Open the calendar
              </ButtonLink>
            </div>
            <p className="mt-6 text-lg font-bold">Any sport. Every level. Always welcome.</p>
          </Reveal>
        </div>
      )}

      <div className="border-t-2 border-ink bg-fr-warm">
        <div className="container-x grid gap-10 pb-12 pt-14 lg:grid-cols-[1.4fr_repeat(2,1fr)]">
          <div>
            <Logo size={84} />
            <p className="mt-4 max-w-[260px] text-[15px] text-fr-charcoal">A community for women who play — runs, tournaments, workshops and meetups.</p>
          </div>
          <FooterCol title="Events" links={[["/events", "All events"], ["/events/calendar", "Events calendar"], ["/#coming-up", "Coming up next"]]} />
          <FooterCol title="Community" links={[["/#how-it-works", "How it works"], ["/#about", "About Femzy"], ["/#categories", "What we play"]]} />
        </div>
        <Squiggle className="container-x block h-4 w-full opacity-30" />
        <div className="container-x flex flex-col gap-2 py-5 text-[13px] text-fr-muted sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Femzy</span>
          <a href="https://voxsera.com/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            Built by Voxsera AI Solutions
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="font-display text-lg font-bold">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-[15px] text-fr-charcoal hover:text-ink hover:underline hover:decoration-fr-yellow hover:decoration-[3px] hover:underline-offset-4">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
