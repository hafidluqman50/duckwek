import Link from 'next/link'
import { MiniDuck } from '@/components/duck/DuckSvg'

const PODIUM = [
  { color: '#4ED1C5', w: 110, bob: '1.2s' },
  { color: '#FFC93C', w: 150, bob: '0.9s' },
  { color: '#FF7AB6', w: 100, bob: '1.1s' },
]

export function FinalCta() {
  return (
    <section data-final className="relative overflow-hidden border-t-[6px] border-black bg-duck text-ink">
      <div data-final-flash aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-white opacity-0" />
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 px-4 py-16 text-center md:px-6 md:py-[100px]">
        <div className="text-lg font-black tracking-[6px]">PHOTO FINISH</div>
        <h2 className="m-0 font-display text-[56px] font-normal leading-[0.95] text-white [-webkit-text-stroke:8px_#000] [paint-order:stroke_fill] md:text-[clamp(56px,8vw,120px)] md:[-webkit-text-stroke:10px_#000]">Your duck is waiting.</h2>
        <div className="flex items-end gap-1.5">
          {PODIUM.map((d) => (
            <div key={d.color} data-final-duck style={{ animation: `dwBob ${d.bob} ease-in-out infinite` }}>
              <MiniDuck color={d.color} width={d.w} />
            </div>
          ))}
        </div>
        <Link href="/play" className="inline-flex h-[70px] items-center rounded-full border-[5px] border-black bg-ink px-11 text-[22px] font-black text-duck no-underline shadow-[0_8px_0_#000]">Play now</Link>
      </div>
    </section>
  )
}
