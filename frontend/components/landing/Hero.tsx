import Link from 'next/link'
import { MiniDuck } from '@/components/duck/DuckSvg'
import { DemoStep } from './DemoStep'

const LANES = [
  { name: 'You', color: '#FFC93C', left: '62%', bob: '0.9s' },
  { name: '#12', color: '#4ED1C5', left: '48%', bob: '1.1s' },
  { name: '#07', color: '#FF7AB6', left: '70%', bob: '1s' },
  { name: '#31', color: '#ffffff', left: '34%', bob: '1.2s' },
  { name: '#44', color: '#B8F35A', left: '55%', bob: '0.95s' },
]

export function Hero() {
  return (
    <section id="top" className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-8 px-4 pb-16 pt-6 md:gap-12 md:px-6 md:pb-20 md:pt-10">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 md:flex-[1_1_520px] md:gap-[22px]">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border-[3px] border-black bg-monad px-3 py-1 text-xs font-black tracking-wide md:px-3.5 md:text-sm">LIVE ON MONAD</span>
        </div>
        <h1 className="stk m-0 font-display text-[56px] font-normal leading-[0.95] text-white md:text-[clamp(56px,7vw,104px)]">
          Every block,<br /><span className="text-duck">every duck,</span><br />one step.
        </h1>
        <p className="m-0 max-w-[520px] text-base font-bold leading-normal text-lilac md:text-xl">
          Live duck racing for the whole room. Scan the QR, pay a 0.10 USDC ticket, meet your duck and race everyone in the room. Anyone can replay the race from the chain.
        </p>
        <div className="flex flex-wrap gap-3.5">
          <Link href="/play" className="inline-flex h-16 items-center justify-center rounded-full border-4 border-black bg-duck px-[34px] text-xl font-black text-ink no-underline shadow-[0_7px_0_#000]">Play now</Link>
          <Link href="/play/create" className="inline-flex h-16 items-center justify-center rounded-full border-4 border-black bg-ink px-[30px] text-xl font-black text-white no-underline shadow-[0_7px_0_#836EF9]">Host a room</Link>
        </div>
        <div className="flex flex-wrap gap-2.5 text-sm font-black">
          <span className="rounded-full border-[3px] border-black bg-duck px-3.5 py-1.5 text-ink">USDC only</span>
          <span className="rounded-full border-[3px] border-black bg-white px-3.5 py-1.5 text-ink">Gas on us</span>
          <span className="rounded-full border-[3px] border-black bg-coral px-3.5 py-1.5 text-ink">No prize pool</span>
        </div>
      </div>

      <div className="relative min-w-0 flex-[1_1_320px] md:flex-[1_1_520px]" data-hero>
        <div className="relative flex flex-col gap-2.5 overflow-hidden rounded-[26px] border-[5px] border-black bg-monad py-3 pl-12 pr-10 shadow-[0_10px_0_#000] md:rounded-[36px] md:border-[6px] md:py-[22px] md:pl-[70px] md:pr-[70px] md:shadow-[0_14px_0_#000]">
          <div aria-hidden="true" className="absolute inset-y-0 right-0 w-[30px] border-l-[5px] border-black bg-[repeating-conic-gradient(#ffffff_0_25%,#1E1446_0_50%)] bg-[length:15px_15px] md:w-[46px] md:bg-[length:23px_23px]" />
          <DemoStep />
          {LANES.map((lane) => (
            <div key={lane.name} className="relative h-[52px] border-b-[3px] border-dashed border-ink md:h-[74px]">
              <div data-hero-duck className="absolute bottom-1 w-[58px] md:w-24" style={{ left: lane.left }}>
                <div style={{ animation: `dwBob ${lane.bob} ease-in-out infinite` }}>
                  <MiniDuck color={lane.color} width="100%" />
                </div>
              </div>
              <span className="absolute left-0 top-1.5 rounded-full border-[3px] border-black bg-white px-2.5 text-[13px] font-black text-ink">{lane.name}</span>
            </div>
          ))}
        </div>
        <div className="absolute -top-6 right-0 rotate-[4deg] rounded-[18px] border-4 border-black bg-duck px-[18px] py-2.5 font-display text-2xl text-ink shadow-[0_6px_0_#000] md:-right-2.5 md:text-[26px]" style={{ animation: 'dwFloat 3s ease-in-out infinite' }}>1 block = 1 step</div>
      </div>
    </section>
  )
}
