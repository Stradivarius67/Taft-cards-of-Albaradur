import { useState, useCallback, useEffect, useRef } from 'react';

export type AnimationEventType =
  | 'card_played'
  | 'bond_trigger'
  | 'morale_wave'
  | 'weather_applied'
  | 'spy_placed'
  | 'medic_revive'
  | 'horn_applied'
  | 'round_end'
  | 'leader_activated'
  | 'score_change';

export interface AnimationEvent {
  type: AnimationEventType;
  data?: Record<string, unknown>;
  duration: number;
}

export function useAnimationQueue() {
  const [queue, setQueue] = useState<AnimationEvent[]>([]);
  const [current, setCurrent] = useState<AnimationEvent | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enqueue = useCallback((events: AnimationEvent[]) => {
    setQueue(prev => [...prev, ...events]);
  }, []);

  const skipAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrent(null);
    setQueue([]);
  }, []);

  useEffect(() => {
    if (current || queue.length === 0) return;

    const next = queue[0];
    setCurrent(next);
    setQueue(prev => prev.slice(1));

    timerRef.current = setTimeout(() => {
      setCurrent(null);
      timerRef.current = null;
    }, next.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, queue]);

  return { current, enqueue, skipAll, isAnimating: current !== null || queue.length > 0 };
}
