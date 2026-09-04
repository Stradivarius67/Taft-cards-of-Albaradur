import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

export function useGameScale() {
  const setIsMobile = useGameStore((s) => s.setIsMobile);
  const frameRef = useRef<number | null>(null);
  const previousRef = useRef<{ mobile: boolean; scale: number } | null>(null);

  useEffect(() => {
    function calculate() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 768;

      let scale: number;
      if (mobile) {
        scale = Math.round(Math.min(Math.max(vw / 375, 0.8), 1.3) * 100) / 100;
      } else {
        const scaleX = vw / 1280;
        const scaleY = vh / 720;
        const aspectRatio = vw / vh;
        scale = aspectRatio > 2.1 ? scaleY : Math.min(scaleX, scaleY);
        scale = Math.round(Math.min(Math.max(scale, 0.7), 2.0) * 100) / 100;
      }

      const previous = previousRef.current;
      if (!previous || previous.mobile !== mobile) {
        setIsMobile(mobile);
        document.documentElement.classList.toggle('mobile', mobile);
        document.documentElement.classList.toggle('desktop', !mobile);
      }
      if (!previous || previous.scale !== scale) {
        document.documentElement.style.setProperty('--game-scale', String(scale));
      }
      previousRef.current = { mobile, scale };
      frameRef.current = null;
    }

    function scheduleCalculate() {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(calculate);
    }

    calculate();
    window.addEventListener('resize', scheduleCalculate, { passive: true });
    return () => {
      window.removeEventListener('resize', scheduleCalculate);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [setIsMobile]);
}
