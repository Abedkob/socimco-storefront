import type {
  AddCartItemBody,
  Cart,
  CategoryNode,
  CreateNegotiationBody,
  CustomerRoundBody,
  LoginBody,
  Negotiation,
  NegotiationSummary,
  Order,
  OrderListQuery,
  OrderSummary,
  PhoneCodeCreateBody,
  PhoneCodeDecisionBody,
  PlaceOrderBody,
  Product,
  ProductQuery,
  ProductsResponse,
  QrApproveBody,
  QrCodeBody,
  QrStatus,
  SellerListQuery,
  SellerRoundBody,
  StoreConfig,
  UpdateCartItemBody,
  User,
} from "./schemas";

export interface RequestContext {
  sessionToken: string | null;
  qrPollToken: string | null;
  clientIp: string;
  userAgent: string;
  /** Origin of the incoming request, used to build absolute links such as the QR approve URL. */
  origin: string;
}

export interface SessionGrant {
  token: string;
  expiresAt: string;
}

/**
 * The single seam between the UI and whatever serves the data.
 * Methods throw ApiError for every expected failure.
 */
export interface ShopBackend {
  store: {
    get(ctx: RequestContext): Promise<StoreConfig>;
  };
  auth: {
    login(ctx: RequestContext, body: LoginBody): Promise<{ user: User; session: SessionGrant }>;
    logout(ctx: RequestContext): Promise<void>;
    me(ctx: RequestContext): Promise<{ user: User }>;
  };
  qr: {
    create(ctx: RequestContext): Promise<{ id: string; approveUrl: string; expiresAt: string; pollToken: string }>;
    status(ctx: RequestContext, id: string): Promise<{ status: QrStatus; expiresAt: string }>;
    scan(ctx: RequestContext, body: QrCodeBody): Promise<{ requestedFrom: string; requestedAt: string }>;
    approve(ctx: RequestContext, body: QrApproveBody): Promise<{ status: "approved" | "denied" }>;
    consume(ctx: RequestContext, id: string): Promise<{ user: User; session: SessionGrant }>;
  };
  /** Phone sign-in: a signed-in computer shows a code; a signed-out phone scans it (see contract/routes.ts). */
  phoneCode: {
    /** Computer, signed in. */
    create(ctx: RequestContext, body: PhoneCodeCreateBody): Promise<{ id: string; scanUrl: string; expiresAt: string; requireApproval: boolean }>;
    /** Computer, owner only. */
    status(ctx: RequestContext, id: string): Promise<{ status: QrStatus; expiresAt: string; requestedFrom: string | null }>;
    /** Computer, owner only, once the phone has scanned. */
    decide(ctx: RequestContext, id: string, body: PhoneCodeDecisionBody): Promise<{ status: "approved" | "denied" }>;
    /** Phone, no session needed. Signs in at once, or (approval mode) binds this phone and waits. */
    redeem(
      ctx: RequestContext,
      body: QrCodeBody,
    ): Promise<
      | { status: "signed_in"; user: User; session: SessionGrant }
      | { status: "awaiting_approval"; id: string; expiresAt: string; pollToken: string }
    >;
    /** Phone, bound by its poll token. */
    progress(ctx: RequestContext, id: string): Promise<{ status: QrStatus; expiresAt: string }>;
    /** Phone, bound by its poll token, once the computer approved. */
    complete(ctx: RequestContext, id: string): Promise<{ user: User; session: SessionGrant }>;
  };
  catalog: {
    categories(ctx: RequestContext): Promise<{ categories: CategoryNode[] }>;
    products(ctx: RequestContext, query: ProductQuery): Promise<ProductsResponse>;
    product(ctx: RequestContext, slug: string): Promise<{ product: Product }>;
  };
  cart: {
    get(ctx: RequestContext): Promise<Cart>;
    addItem(ctx: RequestContext, body: AddCartItemBody): Promise<Cart>;
    updateItem(ctx: RequestContext, productId: string, body: UpdateCartItemBody): Promise<Cart>;
    removeItem(ctx: RequestContext, productId: string): Promise<Cart>;
  };
  negotiations: {
    create(ctx: RequestContext, body: CreateNegotiationBody): Promise<Negotiation>;
    get(ctx: RequestContext, id: string): Promise<Negotiation>;
    round(ctx: RequestContext, id: string, body: CustomerRoundBody): Promise<Negotiation>;
    cancel(ctx: RequestContext, id: string): Promise<Negotiation>;
  };
  seller: {
    list(ctx: RequestContext, query: SellerListQuery): Promise<{ items: NegotiationSummary[] }>;
    get(ctx: RequestContext, id: string): Promise<Negotiation>;
    round(ctx: RequestContext, id: string, body: SellerRoundBody): Promise<Negotiation>;
  };
  orders: {
    place(
      ctx: RequestContext,
      body: PlaceOrderBody & { idempotencyKey: string | null },
    ): Promise<{ order: Order; created: boolean }>;
    list(ctx: RequestContext, query: OrderListQuery): Promise<{ items: OrderSummary[] }>;
    get(ctx: RequestContext, id: string): Promise<{ order: Order }>;
  };
}
