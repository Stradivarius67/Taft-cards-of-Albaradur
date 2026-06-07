import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function useGameScale() {
  const setIsMobile = useGameStore((s) => s.setIsMobile);

  useEffect(() => {
    function calculate() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 768;

      setIsMobile(mobile);

      if (mobile) {
        const s = Math.round(Math.min(Math.max(vw / 375, 0.8), 1.3) * 100) / 100;
        document.documentElement.style.setProperty('--game-scale', String(s));
        document.documentElement.classList.add('mobile');
        document.documentElement.classList.remove('desktop');
      } else {
        const scaleX = vw / 1280;
        const scaleY = vh / 720;
        const aspectRatio = vw / vh;
        let s = aspectRatio > 2.1 ? scaleY : Math.min(scaleX, scaleY);
        s = Math.round(Math.min(Math.max(s, 0.7), 2.0) * 100) / 100;
        document.documentElement.style.setProperty('--game-scale', String(s));
        document.documentElement.classList.add('desktop');
        document.documentElement.classList.remove('mobile');
      }
    }

    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [setIsMobile]);
}
