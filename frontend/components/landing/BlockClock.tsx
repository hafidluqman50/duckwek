const BLOCKS = [
  { offset: '…+1', label: 'start', background: 'bg-white' },
  { offset: '…+2', label: 'tick', background: 'bg-white' },
  { offset: '…+3', label: 'tick', background: 'bg-white' },
  { offset: '…+4', label: 'cheer', background: 'bg-duck' },
  { offset: '…+5', label: 'tick', background: 'bg-white' },
  { offset: '…+6', label: 'tick', background: 'bg-lilac' },
]

export function BlockClock() {
  return (
    <section data-clock className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-8 px-4 py-16 md:gap-12 md:px-6 md:py-[100px]">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-[18px] md:flex-[1_1_420px]">
        <div className="text-base font-black tracking-[4px] text-lilac">ON-CHAIN, REPLAYABLE</div>
        <h2 className="stk m-0 font-display text-[44px] font-normal leading-none md:text-[clamp(44px,5vw,68px)]">The chain is<br />the race clock.</h2>
        <p className="m-0 text-base font-bold leading-relaxed text-lilac md:text-lg">
          The start fixes the seed and the start block. One tick per block moves the pack. The seed, the ordered participants and the cheer log reproduce every position, so anyone can replay the race.
        </p>
      </div>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 md:flex-[1_1_520px]">
        <div className="flex gap-2.5 overflow-hidden py-1">
          {BLOCKS.map((block) => (
            <div key={block.offset} data-clock-block className={`${block.background} flex w-[110px] flex-none flex-col gap-1 rounded-[18px] border-4 border-black p-3 text-ink shadow-[0_6px_0_#000]`}>
              <div className="text-[11px] font-black tracking-wide">BLOCK</div>
              <div className="font-mono text-[15px] font-bold">{block.offset}</div>
              <div className="text-xs font-extrabold">{block.label}</div>
            </div>
          ))}
        </div>
        <div className="h-[22px] overflow-hidden rounded-full border-4 border-black bg-ink"><div data-clock-bar className="h-full w-[62%] border-r-4 border-black bg-duck" /></div>
        <div className="font-mono text-sm text-lilac">step = block.number − startBlock</div>
      </div>
    </section>
  )
}
