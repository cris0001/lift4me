import { Link, useNavigate } from '@tanstack/react-router';

import { useLogin } from '@/features/auth';

import { useLandingTranslation } from '../i18n';
import { useScreenshot } from '../hooks/use-screenshot';
import { CTA, HAND, SECTION } from '../utils/styles';
import { PhoneFrame } from './phone-frame';

// Hero: a hand-lettered note, the three-line headline (the last word in cobalt), the
// lead, and CTAs. From lg up two demo-account phones (dashboard in front, diary behind
// and lower) sit beside it; phones get the text alone.
// The demo account (seed-demo.ts) is public by design, so its credentials can ship in
// the bundle; the API has no password/email change, so visitors can't lock it.
const DEMO_LOGIN = { email: 'demo@gymbro.app', password: 'demo1234' };

export function LandingHero() {
  const t = useLandingTranslation();
  const shot = useScreenshot();
  const navigate = useNavigate();
  const demoLogin = useLogin();

  function openDemo() {
    demoLogin.mutate(DEMO_LOGIN, {
      onSuccess: () => void navigate({ to: '/dashboard' }),
      onError: () => void navigate({ to: '/login' }),
    });
  }

  return (
    <section
      className={`${SECTION} grid items-center gap-12 pt-10 pb-20 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:pb-28`}
    >
      <div className="animate-rise">
        <p className={`${HAND} mb-4 inline-block -rotate-2 text-xl text-[#023e8a] md:text-2xl`}>
          {t.hero.note} ↘
        </p>
        <h1 className="font-heading text-[clamp(40px,4.6vw,64px)] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance">
          {t.hero.lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          <span className="block">
            {t.hero.lastLine} <span className="text-[#023e8a]">{t.hero.accent}</span>
          </span>
        </h1>
        <p className="mt-7 max-w-[520px] text-base leading-relaxed text-[#5b6170] md:text-lg">
          {t.hero.lead}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/register" className={CTA}>
            {t.hero.cta}
          </Link>
          <button
            type="button"
            onClick={openDemo}
            disabled={demoLogin.isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-[#023e8a] px-6 text-[15px] font-bold text-[#023e8a] transition-colors hover:bg-[#023e8a] hover:text-white disabled:opacity-60"
          >
            {t.hero.demo}
          </button>
        </div>
      </div>

      <div className="animate-rise relative hidden h-[680px] [animation-delay:0.25s] lg:block">
        {/* Upright, not rotated: a rotated screenshot blurs its thin lines. */}
        <PhoneFrame className="absolute top-16 left-[6%] w-[250px]">
          <img src={shot('diary')} alt="" className="h-full w-full object-cover object-top" />
        </PhoneFrame>
        <PhoneFrame className="absolute top-0 right-[10%] w-[290px]">
          <img src={shot('dashboard')} alt="" className="h-full w-full object-cover object-top" />
        </PhoneFrame>
        <p
          className={`${HAND} animate-float absolute right-[4%] bottom-0 text-xl text-[#5b6170] [--float-rotate:4deg]`}
        >
          {t.hero.shotNote}
        </p>
      </div>
    </section>
  );
}
