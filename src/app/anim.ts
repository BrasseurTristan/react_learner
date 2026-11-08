import { animate, stagger } from 'animejs'

/** Petites animations d'interface basées sur anime.js (respectent prefers-reduced-motion). */

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function enterStagger(targets: Element[] | NodeListOf<Element> | string, delay = 60) {
  if (reduced()) return
  animate(targets, {
    opacity: { from: 0, to: 1 },
    translateY: { from: 16, to: 0 },
    duration: 520,
    delay: stagger(delay),
    ease: 'outExpo',
  })
}

export function pop(target: Element | null) {
  if (!target || reduced()) return
  animate(target, { scale: [1, 1.25, 1], duration: 420, ease: 'outBack' })
}

export function shake(target: Element | null) {
  if (!target || reduced()) return
  animate(target, { translateX: [0, -6, 6, -4, 4, 0], duration: 420, ease: 'inOutSine' })
}

export function bannerIn(target: Element | null) {
  if (!target || reduced()) return
  animate(target, {
    opacity: [0, 1, 1, 0],
    scale: [0.7, 1, 1, 1.05],
    translateY: [-10, 0, 0, -6],
    duration: 2200,
    ease: 'outQuad',
  })
}

export function celebrate(container: HTMLElement | null) {
  if (!container) return
  const pieces = container.querySelectorAll('.confetti')
  animate(container.querySelectorAll('.star'), {
    scale: { from: 0, to: 1 },
    rotate: { from: -120, to: 0 },
    delay: stagger(160, { start: 250 }),
    duration: 800,
    ease: 'outElastic(1, .6)',
  })
  if (reduced()) return
  pieces.forEach((p) => {
    const el = p as HTMLElement
    animate(el, {
      translateX: { from: 0, to: (Math.random() - 0.5) * 700 },
      translateY: { from: 0, to: 250 + Math.random() * 350 },
      rotate: { from: 0, to: (Math.random() - 0.5) * 1080 },
      opacity: [1, 1, 0],
      duration: 1800 + Math.random() * 1200,
      delay: Math.random() * 300,
      ease: 'outCubic',
    })
  })
}
