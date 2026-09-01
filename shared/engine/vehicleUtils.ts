import type { Vehicles, VehicleBonuses } from '../types';

export function computeVehicleBonuses(vehicles?: Partial<Vehicles> | null): VehicleBonuses {
  const v = vehicles ?? {};
  const taxi          = v.taxi          ?? 0;
  const forklift      = v.forklift      ?? 0;
  const armoredTruck  = v.armored_truck ?? 0;
  const deliveryTruck = v.delivery_truck ?? 0;
  const bus           = v.bus           ?? 0;

  return {
    baseCoinBoostPercent:  armoredTruck  * 5,
    baseXpBoostPercent:    armoredTruck  * 10,
    salesSpeedPercent:     forklift,
    deliverySpeedPercent:  deliveryTruck,
    xpPerSell:             forklift      * 5_000,
    xpPerBuy:              deliveryTruck * 5_000,
    xpPerVisitor:          taxi          * 1_000,
    tipPercent:            bus           * 5,
    extraLobbyCapacity:    bus           * 5,
    extraGemExchangeLimit: taxi,
  };
}
