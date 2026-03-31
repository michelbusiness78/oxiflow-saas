'use client';

import { useState, useEffect } from 'react';

export function Clock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function update() {
      setTime(
        new Intl.DateTimeFormat('fr-FR', {
          hour:   '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      );
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return <span suppressHydrationWarning>{time}</span>;
}
