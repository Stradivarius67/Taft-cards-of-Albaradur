import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  color: string;
  duration?: number;
  trigger: boolean;
}

export default function FlashOverlay({ color, duration = 400, trigger }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), duration);
      return () => clearTimeout(timer);
    }
  }, [trigger, duration]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration / 1000 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: color,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}
    </AnimatePresence>
  );
}
