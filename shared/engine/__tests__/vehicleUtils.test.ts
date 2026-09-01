import { computeVehicleBonuses } from '../vehicleUtils';

const zero = {
  baseCoinBoostPercent: 0,
  baseXpBoostPercent: 0,
  salesSpeedPercent: 0,
  deliverySpeedPercent: 0,
  xpPerSell: 0,
  xpPerBuy: 0,
  xpPerVisitor: 0,
  tipPercent: 0,
  extraLobbyCapacity: 0,
  extraGemExchangeLimit: 0,
};

describe('computeVehicleBonuses', () => {
  it('returns all zeros for undefined input', () => {
    expect(computeVehicleBonuses(undefined)).toEqual(zero);
  });

  it('returns all zeros for empty object', () => {
    expect(computeVehicleBonuses({})).toEqual(zero);
  });

  it('taxi: extraGemExchangeLimit = count, xpPerVisitor = count × 1000', () => {
    const b = computeVehicleBonuses({ taxi: 3 });
    expect(b.extraGemExchangeLimit).toBe(3);
    expect(b.xpPerVisitor).toBe(3_000);
  });

  it('forklift: salesSpeedPercent = count, xpPerSell = count × 5000', () => {
    const b = computeVehicleBonuses({ forklift: 5 });
    expect(b.salesSpeedPercent).toBe(5);
    expect(b.xpPerSell).toBe(25_000);
  });

  it('armored_truck: baseCoinBoostPercent = count × 5, baseXpBoostPercent = count × 10', () => {
    const b = computeVehicleBonuses({ armored_truck: 4 });
    expect(b.baseCoinBoostPercent).toBe(20);
    expect(b.baseXpBoostPercent).toBe(40);
  });

  it('delivery_truck: deliverySpeedPercent = count, xpPerBuy = count × 5000', () => {
    const b = computeVehicleBonuses({ delivery_truck: 7 });
    expect(b.deliverySpeedPercent).toBe(7);
    expect(b.xpPerBuy).toBe(35_000);
  });

  it('bus: extraLobbyCapacity = count × 5, tipPercent = count × 5', () => {
    const b = computeVehicleBonuses({ bus: 2 });
    expect(b.extraLobbyCapacity).toBe(10);
    expect(b.tipPercent).toBe(10);
  });

  it('combines all vehicle types correctly', () => {
    const b = computeVehicleBonuses({ taxi: 10, forklift: 10, armored_truck: 10, delivery_truck: 10, bus: 10 });
    expect(b.extraGemExchangeLimit).toBe(10);
    expect(b.xpPerVisitor).toBe(10_000);
    expect(b.salesSpeedPercent).toBe(10);
    expect(b.xpPerSell).toBe(50_000);
    expect(b.baseCoinBoostPercent).toBe(50);
    expect(b.baseXpBoostPercent).toBe(100);
    expect(b.deliverySpeedPercent).toBe(10);
    expect(b.xpPerBuy).toBe(50_000);
    expect(b.extraLobbyCapacity).toBe(50);
    expect(b.tipPercent).toBe(50);
  });
});
