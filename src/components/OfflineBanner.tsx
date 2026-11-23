import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="z-40 flex items-center justify-center gap-2 border-b border-amber-300/70 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-200"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Offline Mode — Cached app shell, notes, pins & downloaded slides remain available.</span>
    </div>
  );
};
