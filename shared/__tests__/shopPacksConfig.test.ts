import { SHOP_PACKS_DATA, SHOP_PACKS_MAP, SHOP_PACKS_BY_RC_PRODUCT } from '../config/shopPacksConfig';

describe('shopPacksConfig', () => {
  it('has 20 packs', () => {
    expect(SHOP_PACKS_DATA).toHaveLength(20);
  });

  it('all packs have rcProductId starting with com.shmidt.vibetower', () => {
    SHOP_PACKS_DATA.forEach(p => {
      expect(p.rcProductId).toMatch(/^com\.shmidt\.vibetower\.shop\./);
    });
  });

  it('SHOP_PACKS_MAP keys match ids', () => {
    SHOP_PACKS_DATA.forEach(p => {
      expect(SHOP_PACKS_MAP[p.id]).toBe(p);
    });
  });

  it('SHOP_PACKS_BY_RC_PRODUCT keys match rcProductIds', () => {
    SHOP_PACKS_DATA.forEach(p => {
      expect(SHOP_PACKS_BY_RC_PRODUCT[p.rcProductId]).toBe(p);
    });
  });

  it('all packs have priceUsd > 0', () => {
    SHOP_PACKS_DATA.forEach(p => {
      expect(p.priceUsd).toBeGreaterThan(0);
    });
  });
});
