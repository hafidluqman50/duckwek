import { CHAIN_LABEL, CONTRACTS, addressUrl, short } from '@/lib/config'

/** Addresses come from env via lib/config.ts, so the table follows testnet / mainnet / v2 by configuration. */
export function Contracts() {
  return (
    <section id="contracts" className="border-t-[6px] border-black bg-ink">
      <div className="mx-auto flex max-w-[1280px] flex-wrap gap-8 px-4 py-14 md:gap-12 md:px-6 md:py-[90px]">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 md:flex-[1_1_380px]">
          <div className="text-base font-black tracking-[4px] text-lilac">NO BETTING. EVER.</div>
          <h2 className="stk m-0 font-display text-[40px] font-normal leading-none md:text-[clamp(40px,4.5vw,60px)]">Tickets and rent.<br />No prize pool.</h2>
          <p className="m-0 text-[17px] font-bold leading-relaxed text-lilac">Nothing flows from losers to winners. Receivers withdraw their own earnings from the Vault. The contracts are immutable: no proxy, no upgrade key.</p>
        </div>
        {CONTRACTS.length > 0 && (
          <div className="min-w-0 flex-[1_1_320px] overflow-hidden rounded-[26px] border-[5px] border-black bg-white text-ink shadow-[0_10px_0_#000] md:flex-[1_1_560px]">
            <div className="border-b-4 border-black bg-duck px-5 py-3.5 font-black tracking-wider">{CHAIN_LABEL}</div>
            <div className="overflow-x-auto">
              {CONTRACTS.map((c) => (
                <a key={c.name} href={addressUrl(c.address)} target="_blank" rel="noreferrer" className="flex justify-between gap-4 border-b-[3px] border-[#EEE8FF] px-5 py-3 text-ink no-underline">
                  <span className="font-black">{c.name}</span>
                  <span className="font-mono text-sm text-violet">{short(c.address)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
