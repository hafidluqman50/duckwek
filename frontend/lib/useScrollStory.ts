'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Landing motion (GSAP + ScrollTrigger), loaded only on `/` and only on the client.
 * Elements are found by data-attributes set in components/landing/*; every element is visible by default,
 * so reduced motion, no JS and a failed import all leave a complete static page.
 */
export function useScrollStory(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = root.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let cleanup: (() => void) | undefined
    let dead = false
    ;(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      if (dead) return
      gsap.registerPlugin(ScrollTrigger)
      const $ = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s))
      const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
      const offs: (() => void)[] = []

      const ctx = gsap.context(() => {
        // Hero: nearest duck turns and hops (one quickTo per property per duck)
        const hero = el.querySelector<HTMLElement>('[data-hero]')
        const ducks = $('[data-hero-duck]')
        if (hero && fine && ducks.length) {
          const tw = ducks.map((d) => ({ d, y: gsap.quickTo(d, 'y', { duration: 0.3, ease: 'power3.out' }), r: gsap.quickTo(d, 'rotation', { duration: 0.3, ease: 'power3.out' }) }))
          const move = (e: PointerEvent) => {
            let best = 0
            let bd = Infinity
            tw.forEach((t, i) => {
              const b = t.d.getBoundingClientRect()
              const dist = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2))
              if (dist < bd) { bd = dist; best = i }
            })
            tw.forEach((t, i) => {
              if (i === best && bd < 260) {
                const b = t.d.getBoundingClientRect()
                t.y(-16)
                t.r(e.clientX < b.left + b.width / 2 ? -10 : 10)
              } else {
                t.y(0)
                t.r(0)
              }
            })
          }
          const leave = () => tw.forEach((t) => { t.y(0); t.r(0) })
          hero.addEventListener('pointermove', move)
          hero.addEventListener('pointerleave', leave)
          offs.push(() => { hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', leave) })
        }

        // How it works: pinned ~3 screens, scrub Scan -> Hatch -> Race
        const how = el.querySelector<HTMLElement>('[data-how]')
        const cards = $('[data-how-card]')
        const egg = el.querySelector<HTMLElement>('[data-how-egg]')
        const duck = el.querySelector<HTMLElement>('[data-how-duck]')
        const crack = el.querySelector<SVGPathElement>('[data-how-crack]')
        if (how && cards.length === 3 && egg && duck && crack) {
          gsap.set(cards.slice(1), { opacity: 0.35, scale: 0.97 })
          const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: how, start: 'top top', end: '+=300%', pin: true, scrub: 0.6, anticipatePin: 1 } })
          tl.to(egg, { x: 0, duration: 0.2 })
            // step 2: Hatch, one block step, the egg cracks
            .to(cards[0], { opacity: 0.35, scale: 0.97, duration: 0.1 }, 0.3)
            .to(cards[1], { opacity: 1, scale: 1, duration: 0.1 }, 0.3)
            .to(egg, { x: 90, duration: 0.2 }, 0.3)
            .to(crack, { opacity: 1, duration: 0.1 }, 0.45)
            .to(egg, { rotation: 8, yoyo: true, repeat: 3, duration: 0.03 }, 0.45)
            // step 3: Race, the duck runs, one more block step
            .to(egg, { opacity: 0, scale: 0.4, duration: 0.1 }, 0.62)
            .set(duck, { x: 90 }, 0.62)
            .to(duck, { opacity: 1, duration: 0.05 }, 0.62)
            .to(cards[1], { opacity: 0.35, scale: 0.97, duration: 0.1 }, 0.65)
            .to(cards[2], { opacity: 1, scale: 1, duration: 0.1 }, 0.65)
            .to(duck, { x: '+=520', duration: 0.35 }, 0.65)
        }

        // One block = one step: blocks slide in from the right while scrolling
        const blocks = $('[data-clock-block]')
        const clock = el.querySelector<HTMLElement>('[data-clock]')
        if (clock && blocks.length) {
          gsap.from(blocks, { x: 160, opacity: 0, stagger: 0.15, ease: 'none', scrollTrigger: { trigger: clock, start: 'top 80%', end: 'center 55%', scrub: 0.5 } })
          const bar = el.querySelector<HTMLElement>('[data-clock-bar]')
          if (bar) gsap.from(bar, { width: '8%', ease: 'none', scrollTrigger: { trigger: clock, start: 'top 80%', end: 'center 45%', scrub: 0.5 } })
        }

        // Garage cards tilt 3deg toward the pointer
        if (fine) {
          $('[data-garage-card]').forEach((c) => {
            const rx = gsap.quickTo(c, 'rotationY', { duration: 0.3 })
            const ry = gsap.quickTo(c, 'rotationX', { duration: 0.3 })
            gsap.set(c, { transformPerspective: 700 })
            const m = (e: PointerEvent) => {
              const b = c.getBoundingClientRect()
              rx(((e.clientX - b.left) / b.width - 0.5) * 6)
              ry(-((e.clientY - b.top) / b.height - 0.5) * 6)
            }
            const l = () => { rx(0); ry(0) }
            c.addEventListener('pointermove', m)
            c.addEventListener('pointerleave', l)
            offs.push(() => { c.removeEventListener('pointermove', m); c.removeEventListener('pointerleave', l) })
          })
        }

        // Final CTA: photo-finish flash, then the podium ducks bob in slow motion (first view only)
        const fin = el.querySelector<HTMLElement>('[data-final]')
        const flash = el.querySelector<HTMLElement>('[data-final-flash]')
        if (fin && flash) {
          ScrollTrigger.create({
            trigger: fin, start: 'top 60%', once: true,
            onEnter: () => {
              gsap.fromTo(flash, { opacity: 0.95 }, { opacity: 0, duration: 0.6, ease: 'power2.out' })
              gsap.globalTimeline.timeScale(0.35)
              gsap.delayedCall(1.2, () => { gsap.globalTimeline.timeScale(1) })
            },
          })
        }
      }, el)
      cleanup = () => { offs.forEach((f) => f()); ctx.revert() }
    })().catch((e) => console.error('landing motion failed, page stays static', e))
    return () => { dead = true; cleanup?.() }
  }, [root])
}
