import { MiniDuck } from '@/components/duck/DuckSvg'

const STEPS = [
  { number: 1, title: 'Scan the QR', body: "The projector shows the room's QR. Connect a wallet and sign once. No MON needed: the relayer pays gas.", background: 'bg-white' },
  { number: 2, title: 'Hatch your duck', body: 'One duck per wallet. It starts as an egg and hatches on your first paid race.', background: 'bg-duck' },
  { number: 3, title: 'Race the room', body: 'Pay a 0.10 USDC ticket. Every Monad block moves every duck one step. Tap CHEER to push yours.', background: 'bg-monad' },
]

export function HowItWorks() {
  return (
    <section id="how" data-how className="border-y-[6px] border-black bg-ink">
      <div data-how-pin className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-14 md:gap-10 md:px-6 md:py-[90px]">
        <div className="flex flex-col gap-2">
          <div className="text-base font-black tracking-[4px] text-lilac">HOW IT WORKS</div>
          <h2 className="stk m-0 font-display text-[44px] font-normal leading-none text-duck md:text-[clamp(44px,5vw,72px)]">Scan. Hatch. Race.</h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
          {STEPS.map((step) => (
            <div key={step.number} data-how-card className={`${step.background} flex flex-col gap-3.5 rounded-[30px] border-[5px] border-black p-7 text-ink shadow-[0_10px_0_#000]`}>
              <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-black font-display text-[34px] ${step.number === 1 ? 'bg-duck' : 'bg-white'}`}>{step.number}</div>
              <div className="font-display text-4xl">{step.title}</div>
              <p className="m-0 text-[17px] font-bold leading-normal">{step.body}</p>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="relative h-[84px] rounded-[22px] border-4 border-black bg-monad">
          <div className="absolute inset-x-6 bottom-3 h-1 border-t-[3px] border-dashed border-ink" />
          <div data-how-egg className="absolute bottom-3 left-[8%] w-14">
            <svg viewBox="0 0 60 76" width="100%"><path d="M30 4C14 4 6 30 6 48c0 16 11 26 24 26s24-10 24-26C54 30 46 4 30 4z" fill="#fff" stroke="#000" strokeWidth="5" /><path data-how-crack d="M14 40l9 8 6-10 8 10 9-8" fill="none" stroke="#000" strokeWidth="4" strokeLinejoin="round" opacity="0" /></svg>
          </div>
          <div data-how-duck className="absolute bottom-3 left-[8%] w-[72px] opacity-0">
            <MiniDuck color="#FFC93C" width="100%" />
          </div>
        </div>
      </div>
    </section>
  )
}
