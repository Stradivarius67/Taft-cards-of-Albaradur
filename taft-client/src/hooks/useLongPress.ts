import { useRef, useCallback, useEffect } from 'react';

export function useLongPress(callback: () => void, ms = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const didLongPressRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    cancel();
    didLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      didLongPressRef.current = true;
      callbackRef.current();
    }, ms);
  }, [cancel, ms]);

  const shouldSuppressClick = useCallback(() => {
    if (!didLongPressRef.current) return false;
    didLongPressRef.current = false;
    return true;
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onTouchCancel: cancel,
    shouldSuppressClick,
  };
}
