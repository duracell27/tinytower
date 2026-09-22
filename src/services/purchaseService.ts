import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type PurchasesStoreProduct,
  PurchasesError,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

const RC_API_KEY =
  Platform.OS === 'ios'
    ? (process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? '')
    : (process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? '');

export const purchaseService = {
  initialize(userId: string): void {
    if (!RC_API_KEY) {
      console.warn('[RC] No API key configured');
      return;
    }
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId });
  },

  async getProducts(rcProductIds: string[]): Promise<PurchasesStoreProduct[]> {
    try {
      return await Purchases.getProducts(rcProductIds);
    } catch {
      return [];
    }
  },

  async purchase(rcProductId: string): Promise<{ transactionId: string }> {
    const products = await purchaseService.getProducts([rcProductId]);
    if (!products.length) {
      throw new Error(`Product not found: ${rcProductId}`);
    }

    // purchaseStoreProduct throws PurchasesError on cancel or error —
    // let it propagate so callers can check PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    const result = await Purchases.purchaseStoreProduct(products[0]);

    // In v10, MakePurchaseResult.transaction is non-optional (PurchasesStoreTransaction)
    const transactionId = result.transaction.transactionIdentifier;

    return { transactionId };
  },

  async restorePurchases(): Promise<void> {
    await Purchases.restorePurchases();
  },
};

export { PurchasesError, PURCHASES_ERROR_CODE };
export type { PurchasesStoreProduct };
