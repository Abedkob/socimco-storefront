import type { ShopBackend } from "@/core/contract";
import { createAuth } from "./auth";
import { createCartApi } from "./cart";
import { createCatalog } from "./catalog";
import { createNegotiations, createSeller } from "./negotiations";
import { createOrders } from "./orders";
import { createPhoneCode } from "./phone-code";
import { createQr } from "./qr";
import { createRateLimiter } from "./rate-limit";
import { loadSeed, type Seed } from "./seed";
import { createState, type Deps } from "./state";

export interface MockBackendOptions {
  /** Injectable clock so expiry rules can be tested. */
  now?: () => Date;
}

export function createMockBackend(seed: Seed = loadSeed(), options: MockBackendOptions = {}): ShopBackend {
  const now = options.now ?? (() => new Date());
  const deps: Deps = {
    state: createState(seed),
    now,
    limiter: createRateLimiter(() => now().getTime()),
  };
  return {
    store: { get: async () => structuredClone(deps.state.store) },
    auth: createAuth(deps),
    qr: createQr(deps),
    phoneCode: createPhoneCode(deps),
    catalog: createCatalog(deps),
    cart: createCartApi(deps),
    negotiations: createNegotiations(deps),
    seller: createSeller(deps),
    orders: createOrders(deps),
  };
}

export { checkSeedIntegrity, loadSeed, RAW_SEED, REFERENCE_FIXTURE, Seed } from "./seed";
