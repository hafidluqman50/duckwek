import Link from 'next/link'

export function Hosts() {
  return (
    <section id="host" className="border-y-[6px] border-black bg-monad text-ink">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-8 px-4 py-14 md:gap-12 md:px-6 md:py-[90px]">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-[30px] border-[6px] border-black bg-ink p-[18px] shadow-[0_12px_0_#000] md:flex-[1_1_480px]">
          <div className="flex gap-2">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-black bg-coral" />
            <span className="h-3.5 w-3.5 rounded-full border-2 border-black bg-duck" />
            <span className="h-3.5 w-3.5 rounded-full border-2 border-black bg-lime" />
          </div>
          <div className="flex items-center gap-4 rounded-[18px] bg-night p-[18px]">
            <div className="flex flex-1 flex-col gap-2">
              <span className="self-start rounded-full border-[3px] border-black bg-duck px-3 py-1 font-mono font-bold">WEK-7Q2</span>
              <div className="font-display text-[34px] leading-none text-white md:text-[40px]">Demo room</div>
              <div className="text-sm font-extrabold text-lilac">TRACK · Kali Code Sprint</div>
            </div>
            <div role="img" aria-label="Sample QR code" className="h-[110px] w-[110px] flex-none rounded-xl border-[6px] border-white bg-[repeating-conic-gradient(#1E1446_0_25%,#ffffff_0_50%)] bg-[length:26px_26px] md:h-[130px] md:w-[130px]" />
          </div>
          <div className="text-center text-[13px] font-extrabold text-lilac">Projector view · /stage/WEK-7Q2 · sample</div>
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-[18px] md:flex-[1_1_420px]">
          <div className="text-base font-black tracking-[4px]">FOR HOSTS</div>
          <h2 className="stk m-0 font-display text-[44px] font-normal leading-none text-white md:text-[clamp(44px,5vw,68px)]">Put the race<br />on the projector.</h2>
          <p className="m-0 text-base font-bold leading-relaxed md:text-lg">Rent a track for 1 USDC, open the stage on the big screen and let the room scan in. Up to 200 slots per race. Start when the room is ready.</p>
          <Link href="/play/create" className="inline-flex h-[60px] items-center self-start rounded-full border-4 border-black bg-duck px-[30px] text-[19px] font-black text-ink no-underline shadow-[0_7px_0_#000]">Create a room</Link>
        </div>
      </div>
    </section>
  )
}
