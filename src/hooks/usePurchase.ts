import { useState, useCallback } from 'react';
import { purchaseService, PURCHASES_ERROR_CODE } from '../services/purchaseService';
import { api } from '../services/api';
import { syncService } from '../services/sync';
import { useGameStore } from '../stores/gameStore';
import type { ShopPack } from '../data/shopPacks';

export function usePurchase() {
  const [error, setError] = useState<string | null>(null);
  const setManualPurchaseSuccess = useGameStore((s) => s.setManualPurchaseSuccess);
  const setPurchasingActive = useGameStore((s) => s.setPurchasingActive);
  const purchasing = useGameStore((s) => s.purchasingActive);

  const purchase = useCallback(
    async (pack: ShopPack) => {
      setPurchasingActive(true);
      setError(null);

      try {
        const { transactionId } = await purchaseService.purchase(pack.rcProductId);
        const { rewards } = await api.notifyPurchase({ packId: pack.id, transactionId });

        setManualPurchaseSuccess({
          packName: pack.name,
          price: pack.price,
          rewards,
        });

        syncService.triggerSync();
      } catch (err) {
        // PurchasesError is an interface (not a class), so use duck-typing
        const code = (err as { code?: string } | null)?.code;
        if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          // User cancelled — silently ignore
          return;
        }
        const message = err instanceof Error ? err.message : 'Purchase failed';
        setError(message);
      } finally {
        setPurchasingActive(false);
      }
    },
    [setManualPurchaseSuccess, setPurchasingActive],
  );

  return {
    purchasing,
    purchase,
    error,
    clearError: () => setError(null),
  };
}
