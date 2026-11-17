'use client'

import { useEffect, type RefObject } from 'react'

export function useScrollStory(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const rootElement = root.current

    if (!rootElement || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cleanup: (() => void) | undefined
    let disposed = false

    ;(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])

      if (disposed) return

      gsap.registerPlugin(ScrollTrigger)

      const selectAll = (selector: string) => Array.from(rootElement.querySelectorAll<HTMLElement>(selector))
      const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
      const teardowns: (() => void)[] = []

      const context = gsap.context(() => {
        const hero = rootElement.querySelector<HTMLElement>('[data-hero]')
        const heroDucks = selectAll('[data-hero-duck]')

        if (hero && hasFinePointer && heroDucks.length) {
          const tweens = heroDucks.map((heroDuck) => ({ element: heroDuck, moveY: gsap.quickTo(heroDuck, 'y', { duration: 0.3, ease: 'power3.out' }), rotate: gsap.quickTo(heroDuck, 'rotation', { duration: 0.3, ease: 'power3.out' }) }))

          const onPointerMove = (event: PointerEvent) => {
            let nearestIndex = 0
            let nearestDistance = Infinity

            tweens.forEach((tween, index) => {
              const bounds = tween.element.getBoundingClientRect()
              const distance = Math.hypot(event.clientX - (bounds.left + bounds.width / 2), event.clientY - (bounds.top + bounds.height / 2))

              if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index }
            })

            tweens.forEach((tween, index) => {
              if (index === nearestIndex && nearestDistance < 260) {
                const bounds = tween.element.getBoundingClientRect()

                tween.moveY(-16)
                tween.rotate(event.clientX < bounds.left + bounds.width / 2 ? -10 : 10)
              } else {
                tween.moveY(0)
                tween.rotate(0)
              }
            })
          }

          const onPointerLeave = () => tweens.forEach((tween) => { tween.moveY(0); tween.rotate(0) })

          hero.addEventListener('pointermove', onPointerMove)
          hero.addEventListener('pointerleave', onPointerLeave)
          teardowns.push(() => { hero.removeEventListener('pointermove', onPointerMove); hero.removeEventListener('pointerleave', onPointerLeave) })
        }

        const how = rootElement.querySelector<HTMLElement>('[data-how]')
        const cards = selectAll('[data-how-card]')
        const egg = rootElement.querySelector<HTMLElement>('[data-how-egg]')
        const duck = rootElement.querySelector<HTMLElement>('[data-how-duck]')
        const crack = rootElement.querySelector<SVGPathElement>('[data-how-crack]')

        if (how && cards.length === 3 && egg && duck && crack) {
          gsap.set(cards.slice(1), { opacity: 0.35, scale: 0.97 })

          const timeline = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: how, start: 'top top', end: '+=300%', pin: true, scrub: 0.6, anticipatePin: 1 } })

          timeline.to(egg, { x: 0, duration: 0.2 })
            .to(cards[0], { opacity: 0.35, scale: 0.97, duration: 0.1 }, 0.3)
            .to(cards[1], { opacity: 1, scale: 1, duration: 0.1 }, 0.3)
            .to(egg, { x: 90, duration: 0.2 }, 0.3)
            .to(crack, { opacity: 1, duration: 0.1 }, 0.45)
            .to(egg, { rotation: 8, yoyo: true, repeat: 3, duration: 0.03 }, 0.45)
            .to(egg, { opacity: 0, scale: 0.4, duration: 0.1 }, 0.62)
            .set(duck, { x: 90 }, 0.62)
            .to(duck, { opacity: 1, duration: 0.05 }, 0.62)
            .to(cards[1], { opacity: 0.35, scale: 0.97, duration: 0.1 }, 0.65)
            .to(cards[2], { opacity: 1, scale: 1, duration: 0.1 }, 0.65)
            .to(duck, { x: '+=520', duration: 0.35 }, 0.65)
        }

        const blocks = selectAll('[data-clock-block]')
        const clock = rootElement.querySelector<HTMLElement>('[data-clock]')

        if (clock && blocks.length) {
          gsap.from(blocks, { x: 160, opacity: 0, stagger: 0.15, ease: 'none', scrollTrigger: { trigger: clock, start: 'top 80%', end: 'center 55%', scrub: 0.5 } })

          const bar = rootElement.querySelector<HTMLElement>('[data-clock-bar]')

          if (bar) gsap.from(bar, { width: '8%', ease: 'none', scrollTrigger: { trigger: clock, start: 'top 80%', end: 'center 45%', scrub: 0.5 } })
        }

        if (hasFinePointer) {
          selectAll('[data-garage-card]').forEach((card) => {
            const rotateY = gsap.quickTo(card, 'rotationY', { duration: 0.3 })
            const rotateX = gsap.quickTo(card, 'rotationX', { duration: 0.3 })

            gsap.set(card, { transformPerspective: 700 })

            const onPointerMove = (event: PointerEvent) => {
              const bounds = card.getBoundingClientRect()

              rotateY(((event.clientX - bounds.left) / bounds.width - 0.5) * 6)
              rotateX(-((event.clientY - bounds.top) / bounds.height - 0.5) * 6)
            }

            const onPointerLeave = () => { rotateY(0); rotateX(0) }

            card.addEventListener('pointermove', onPointerMove)
            card.addEventListener('pointerleave', onPointerLeave)
            teardowns.push(() => { card.removeEventListener('pointermove', onPointerMove); card.removeEventListener('pointerleave', onPointerLeave) })
          })
        }

        const finalSection = rootElement.querySelector<HTMLElement>('[data-final]')
        const flash = rootElement.querySelector<HTMLElement>('[data-final-flash]')

        if (finalSection && flash) {
          ScrollTrigger.create({
            trigger: finalSection, start: 'top 60%', once: true,
            onEnter: () => {
              gsap.fromTo(flash, { opacity: 0.95 }, { opacity: 0, duration: 0.6, ease: 'power2.out' })
              gsap.globalTimeline.timeScale(0.35)
              gsap.delayedCall(1.2, () => { gsap.globalTimeline.timeScale(1) })
            },
          })
        }
      }, rootElement)

      cleanup = () => { teardowns.forEach((teardown) => teardown()); context.revert() }
    })().catch((error) => console.error('landing motion failed, page stays static', error))

    return () => { disposed = true; cleanup?.() }
  }, [root])
}
