import { createEntitlementsService, Entitlements } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

export type { Entitlements };

const service = createEntitlementsService({
  getPaymentApiUrl: () => getGlobalConfig().PAYMENT_API_URL!
});

export const { getMyEntitlements } = service;
