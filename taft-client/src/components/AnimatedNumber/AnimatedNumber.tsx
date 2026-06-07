import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './AnimatedNumber.module.css';

interface Props {
  value: number;
  className?: string;
}

export default function AnimatedNumber({ value, className }: Props) {
  const prevValue = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value > prevValue.current) setFlash('up');
    else if (value < prevValue.current) setFlash('down');
    prevValue.current = value;
    const timer = setTimeout(() => setFlash(null), 300);
    return () => clearTimeout(timer);
  }, [value]);

  const flashClass = flash === 'up' ? styles.flashUp : flash === 'down' ? styles.flashDown : '';

  return (
    <motion.span
      key={value}
      initial={{ scale: 1.15 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`${className ?? ''} ${flashClass}`}
    >
      {value}
    </motion.span>
  );
}
