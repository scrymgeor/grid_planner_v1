import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 shadow-sm lg:bottom-4 lg:left-auto lg:right-6 lg:w-auto dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-200"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>Offline mode — Local scheduling & streak tracking active. Echo needs connection.</span>
      </div>
    </div>
  );
};
