import { useEffect } from 'react';
import { useModalQueueStore } from '../stores/modalQueueStore';

/**
 * Register a modal in the global notification queue.
 * Returns true only when this modal is the active one (its turn to show).
 * Prevents two <Modal visible> at the same time which freezes iOS/Fabric.
 */
export function useModalQueue(name: string, wantsToShow: boolean): boolean {
  const request = useModalQueueStore((s) => s.request);
  const release = useModalQueueStore((s) => s.release);
  const isActive = useModalQueueStore((s) => s.active === name);

  useEffect(() => {
    if (!wantsToShow) {
      release(name);
      return;
    }
    request(name);
    return () => { release(name); };
  }, [wantsToShow, name, request, release]);

  return isActive;
}
