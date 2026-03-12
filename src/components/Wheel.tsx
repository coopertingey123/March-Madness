import { useState, useCallback, useEffect } from 'react';
import { Wheel as RouletteWheel } from 'react-custom-roulette';
import type { Game } from '../types';
import styles from './Wheel.module.css';

interface WheelProps {
  segments: Game[];
  onSpinComplete: (landed: Game) => void;
  disabled?: boolean;
  onSpinningChange?: (spinning: boolean) => void;
  spinSignal: number;
}

export default function Wheel({ segments, onSpinComplete, disabled, onSpinningChange, spinSignal }: WheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeIndex, setPrizeIndex] = useState(0);

  const spin = useCallback(() => {
    if (segments.length === 0 || spinning || disabled) return;
    setSpinning(true);
    setMustSpin(true);
    onSpinningChange?.(true);
    const index = Math.floor(Math.random() * segments.length);
    setPrizeIndex(index);
  }, [segments, spinning, disabled, onSpinningChange]);

  // Respond to external spin requests (only when spinSignal changes)
  useEffect(() => {
    if (spinSignal === 0) return;
    spin();
    // Intentionally not depending on `spin` to avoid re-triggering when it re-creates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinSignal]);

  if (segments.length === 0) {
    return (
      <div className={styles.wheelWrap}>
        <p className={styles.empty}>No spreads left on the wheel. Start a new round or add more.</p>
      </div>
    );
  }

  const data = segments.map((g) => ({ option: g.display }));

  return (
    <div className={styles.wheelWrap}>
      <div className={styles.pointer} aria-hidden />
      <div className={styles.wheel}>
        <RouletteWheel
          mustStartSpinning={mustSpin}
          prizeNumber={prizeIndex}
          data={data}
          backgroundColors={[
            '#f77f00', // orange
            '#00b894', // teal
            '#e63946', // red
            '#4361ee', // blue
            '#ffd166', // yellow
            '#06d6a0', // mint
          ]}
          textColors={['#f4f1de']}
          outerBorderColor="#d4a03a"
          outerBorderWidth={8}
          innerRadius={15}
          radiusLineColor="#0d3b2e"
          radiusLineWidth={1}
          fontSize={13}
          spinDuration={0.5}
          onStopSpinning={() => {
            setMustSpin(false);
            setSpinning(false);
            onSpinningChange?.(false);
            const landed = segments[prizeIndex];
            if (landed) onSpinComplete(landed);
          }}
        />
      </div>
    </div>
  );
}
