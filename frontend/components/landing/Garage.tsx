const PARTS = [
  { name: 'Layangan Wings', effect: 'Wings · Speed +2 · Weight 0 · Boost −1', bg: '#7CC6FE', part: '58,66 98,34 110,40 90,74', fill: '#ffffff' },
  { name: 'Turbo Tail', effect: 'Tail · Speed +1 · Weight +1 · Boost 0', bg: '#FF7AB6', part: '36,64 6,52 16,72 6,92 38,84', fill: '#FF9F1C' },
  { name: 'Iron Bill', effect: 'Bill · Speed −1 · Weight +1 · Boost +2', bg: '#B8F35A', part: '118,30 147,39 118,48', fill: '#9AA3B8' },
]

export function Garage() {
  return (
    <section id="garage" className="mx-auto flex max-w-[1280px] flex-col gap-9 px-4 py-16 md:px-6 md:py-[100px]">
      <div className="flex flex-col gap-2">
        <div className="text-base font-black tracking-[4px] text-lilac">GARAGE</div>
        <h2 className="stk m-0 font-display text-[44px] font-normal leading-none text-duck md:text-[clamp(44px,5vw,68px)]">Tune your duck.</h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[22px]">
        {PARTS.map((p) => (
          <div key={p.name} data-garage-card className="flex flex-col gap-3 rounded-[28px] border-[5px] border-black bg-white p-[22px] text-ink shadow-[0_10px_0_#000] transition-[translate,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[0_14px_0_#000]">
            <div className="flex h-[140px] items-center justify-center rounded-[20px] border-4 border-black" style={{ background: p.bg }}>
              <svg viewBox="0 0 150 105" width="150" aria-hidden="true" style={{ overflow: 'visible' }}>
                <polygon points="40,72 56,54 94,52 122,62 118,86 84,98 50,94" fill="#FFC93C" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
                <polygon points={p.part} fill={p.fill} stroke="#000" strokeWidth="4" strokeLinejoin="round" />
                <polygon points="88,52 90,30 106,20 120,28 122,48 110,58" fill="#FFC93C" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
                <polygon points="120,32 140,39 120,46" fill="#FF9F1C" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
                <circle cx="109" cy="34" r="4" fill="#000" />
              </svg>
            </div>
            <div className="flex items-center justify-between gap-2.5">
              <div className="font-display text-[28px]">{p.name}</div>
              <span className="whitespace-nowrap rounded-full border-[3px] border-black bg-duck px-2.5 py-0.5 text-[13px] font-black">1 USDC</span>
            </div>
            <div className="text-[15px] font-bold">{p.effect}</div>
          </div>
        ))}
      </div>
      <div className="text-[15px] font-bold text-lilac">Parts are licenses. Podium finishers earn soulbound titles that cannot be bought.</div>
    </section>
  )
}
