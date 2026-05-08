import type { Variants } from 'framer-motion'

export const inkSpread: Variants = {
  hidden:  { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: 'easeIn' } },
}

export const candleBreathe: Variants = {
  idle: {
    opacity: [0.85, 1, 0.85],
    scale: [1, 1.003, 1],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
}

export const summonFade: Variants = {
  hidden:  { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2, ease: 'easeIn' } },
}

export const phaseTransition: Variants = {
  enter:  (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit:   (dir: number) => ({ x: dir < 0 ? 40 : -40, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }),
}

export const backdropFade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
}
