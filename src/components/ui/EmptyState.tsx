'use client';

import LottiePlayer from './LottiePlayer';

const DEFAULT_ANIMATION = 'https://assets3.lottiefiles.com/packages/lf20_ysas4vcp.json';

interface EmptyStateProps {
  title: string;
  message?: string;
  /** Optional Lottie animation URL — defaults to the empty-box animation */
  animation?: string | false;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ title, message, animation, action }: EmptyStateProps) {
  const animSrc = animation === false ? null : (animation ?? DEFAULT_ANIMATION);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      {animSrc && (
        <LottiePlayer
          src={animSrc}
          width={160}
          height={160}
          loop
          autoplay
        />
      )}
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-700">{title}</p>
        {message && (
          <p className="text-sm text-slate-400">{message}</p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
