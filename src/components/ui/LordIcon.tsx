'use client';

import { useEffect, useRef, useState } from 'react';
import { Player } from '@lordicon/react';

// Simple in-memory cache to avoid re-fetching the same URL
const iconCache = new Map<string, object>();

interface LordIconProps {
  /** URL to the Lordicon JSON (CDN or local) */
  icon: string;
  /** Icon size in px (default 24) */
  size?: number;
  /** When to play the animation */
  trigger?: 'hover' | 'click' | 'loop';
  /** Colors string — e.g. "primary:#3b82f6,secondary:#94a3b8" */
  colors?: string;
  className?: string;
}

export default function LordIcon({
  icon,
  size = 24,
  trigger = 'hover',
  colors,
  className,
}: LordIconProps) {
  const playerRef = useRef<Player>(null);
  const [iconData, setIconData] = useState<object | null>(iconCache.get(icon) ?? null);

  // Fetch + cache the JSON icon data
  useEffect(() => {
    if (iconData) return; // already loaded
    let cancelled = false;
    fetch(icon)
      .then((r) => r.json())
      .then((data: object) => {
        if (!cancelled) {
          iconCache.set(icon, data);
          setIconData(data);
        }
      })
      .catch(() => { /* silently ignore — falls back to no icon */ });
    return () => { cancelled = true; };
  }, [icon, iconData]);

  // Loop trigger: replay on every complete
  const handleComplete = () => {
    if (trigger === 'loop') {
      playerRef.current?.playFromBeginning();
    }
  };

  // Start loop automatically when icon loads
  useEffect(() => {
    if (iconData && trigger === 'loop') {
      // Small delay so the Player has mounted
      const t = setTimeout(() => playerRef.current?.playFromBeginning(), 50);
      return () => clearTimeout(t);
    }
  }, [iconData, trigger]);

  if (!iconData) return <span style={{ display: 'inline-block', width: size, height: size }} className={className} />;

  const interactionProps =
    trigger === 'hover'
      ? {
          onMouseEnter: () => playerRef.current?.playFromBeginning(),
          onMouseLeave: () => {
            playerRef.current?.pause();
            playerRef.current?.goToFirstFrame();
          },
        }
      : trigger === 'click'
      ? { onClick: () => playerRef.current?.playFromBeginning() }
      : {};

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      {...interactionProps}
    >
      <Player
        ref={playerRef}
        icon={iconData}
        size={size}
        colors={colors}
        onComplete={handleComplete}
      />
    </span>
  );
}
