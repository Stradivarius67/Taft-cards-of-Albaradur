// Standard animation variants for reuse across components

export const cardEnter = {
  initial: { y: 80, opacity: 0, scale: 0.6 },
  animate: { y: 0, opacity: 1, scale: 1 },
  transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] },
};

export const cardExit = {
  exit: { opacity: 0, scale: 0.7, y: 20 },
  transition: { duration: 0.25 },
};

export const cardFromOpponent = {
  initial: { y: -80, opacity: 0, scale: 0.6 },
  animate: { y: 0, opacity: 1, scale: 1 },
  transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] },
};

export const cardFromHand = {
  initial: { x: 100, opacity: 0, scale: 0.8 },
  animate: { x: 0, opacity: 1, scale: 1 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

export const cardExitHand = {
  exit: { y: -60, opacity: 0, scale: 0.8 },
  transition: { duration: 0.25, ease: 'easeIn' },
};

export const spyEnter = {
  initial: { y: -120, opacity: 0, scale: 0.5, rotate: -5 },
  animate: { y: 0, opacity: 1, scale: 1, rotate: 0 },
  transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3 },
};

export const popIn = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.25, ease: 'backOut' as const },
};

export const overlayEnter = {
  initial: { y: -50, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { duration: 0.3 },
};

export const overlayExit = {
  exit: { y: -30, opacity: 0 },
  transition: { duration: 0.2 },
};

export const stagger = (delay: number = 0.05) => ({
  animate: { transition: { staggerChildren: delay } },
});
