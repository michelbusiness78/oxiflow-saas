'use client';

import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

// Simple in-memory cache to avoid re-fetching the same URL
const animCache = new Map<string, object>();

interface LottiePlayerProps {
  /** URL to the Lottie animation JSON */
  src: string;
  width?: number | string;
  height?: number | string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}

export default function LottiePlayer({
  src,
  width = 200,
  height = 200,
  loop = true,
  autoplay = true,
  className,
}: LottiePlayerProps) {
  const [animData, setAnimData] = useState<object | null>(animCache.get(src) ?? null);

  useEffect(() => {
    if (animData) return;
    let cancelled = false;
    fetch(src)
      .then((r) => r.json())
      .then((data: object) => {
        if (!cancelled) {
          animCache.set(src, data);
          setAnimData(data);
        }
      })
      .catch(() => { /* silently ignore network errors */ });
    return () => { cancelled = true; };
  }, [src, animData]);

  if (!animData) return null;

  return (
    <Lottie
      animationData={animData}
      loop={loop}
      autoplay={autoplay}
      style={{ width, height }}
      className={className}
    />
  );
}
