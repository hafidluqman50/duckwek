import { Nav } from './Nav'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { BlockClock } from './BlockClock'
import { Hosts } from './Hosts'
import { Garage } from './Garage'
import { Contracts } from './Contracts'
import { FinalCta } from './FinalCta'
import { ScrollStory } from './ScrollStory'

export function Landing() {
  return (
    <div className="overflow-x-clip bg-night font-sans text-white">
      <Nav />
      <ScrollStory>
        <Hero />
        <HowItWorks />
        <BlockClock />
        <Hosts />
        <Garage />
        <Contracts />
        <FinalCta />
      </ScrollStory>
      <footer className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-4 py-7 text-sm font-bold text-lilac md:px-6">
        <span>DuckWek · built for Monad Blitz Jogja Vol. 2</span>
        <span>USDC only · gas on us · no prize pool</span>
      </footer>
    </div>
  )
}
