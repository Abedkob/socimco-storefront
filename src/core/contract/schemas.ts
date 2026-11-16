import { z } from "zod";

export const Cents = z.number().int().min(0);
export const PositiveCents = z.number().int().min(1);
/** ISO 8601 date-time; "Z" or an explicit offset (e.g. +02:00). */
export const Timestamp = z.iso.datetime({ offset: true });
/** URL-safe identifier used in /products/:slug and /category/:slug. Real backends may use ids or SKUs here. */
export const Slug = z.string().max(200).regex(/^[A-Za-z0-9](?:[A-Za-z0-9_~-]|\.(?!\.))*$/);
const Id = z.string().min(1).max(100);
const Quantity = z.number().int().min(1).max(100_000);
const Message = z.string().trim().max(500).optional();

export const StoreConfig = z.object({
  name: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  logoUrl: z.string(),
  negotiation: z.object({
    enabled: z.boolean(),
    maxCustomerRounds: z.number().int().min(1),
    offerExpiryHours: z.number().positive(),
    acceptedPriceValidHours: z.number().positive(),
  }),
});
export type StoreConfig = z.infer<typeof StoreConfig>;

export const Category = z.object({
  id: Id,
  slug: Slug,
  name: z.string().min(1),
  parentId: Id.nullable(),
  imageUrl: z.string(),
  sortOrder: z.number().int(),
});
export type Category = z.infer<typeof Category>;

export const CategoryChild = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  imageUrl: z.string(),
  productCount: z.number().int().min(0),
});
export const CategoryNode = CategoryChild.extend({
  sortOrder: z.number().int(),
  children: z.array(CategoryChild),
});
export type CategoryNode = z.infer<typeof CategoryNode>;

export const ProductUnit = z.enum(["piece", "box", "meter"]);
export type ProductUnit = z.infer<typeof ProductUnit>;

export const Product = z
  .object({
    id: Id,
    sku: z.string().min(1),
    slug: Slug,
    name: z.string().min(1),
    brand: z.string().min(1),
    categoryId: Id,
    description: z.string(),
    images: z.array(z.string()).min(1),
    priceCents: PositiveCents,
    unit: ProductUnit,
    stock: z.number().int().min(0),
    minOrderQty: z.number().int().min(1),
    negotiable: z.boolean(),
    minNegotiableQty: z.number().int().min(1).nullable(),
    specs: z.record(z.string(), z.string()),
    rating: z.number().min(0).max(5),
    createdAt: Timestamp,
  })
  .refine((p) => !p.negotiable || p.minNegotiableQty !== null, {
    message: "Negotiable products need minNegotiableQty",
    path: ["minNegotiableQty"],
  });
export type Product = z.infer<typeof Product>;

export const ProductListItem = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  brand: z.string(),
  imageUrl: z.string(),
  priceCents: PositiveCents,
  unit: ProductUnit,
  inStock: z.boolean(),
  negotiable: z.boolean(),
  minNegotiableQty: z.number().int().nullable(),
  rating: z.number(),
});
export type ProductListItem = z.infer<typeof ProductListItem>;

export const Address = z.object({
  id: Id,
  label: z.string().min(1),
  line1: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  isDefault: z.boolean(),
});
export type Address = z.infer<typeof Address>;

export const Role = z.enum(["customer", "seller"]);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  id: Id,
  name: z.string().min(1),
  email: z.email(),
  company: z.string().min(1),
  role: Role,
  addresses: z.array(Address),
});
export type User = z.infer<typeof User>;

export const CartLine = z.object({
  productId: Id,
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  unit: ProductUnit,
  quantity: Quantity,
  unitPriceCents: PositiveCents,
  lineTotalCents: Cents,
  negotiationEligible: z.boolean(),
});
export type CartLine = z.infer<typeof CartLine>;

export const Cart = z.object({
  lockedByNegotiationId: Id.nullable(),
  currency: z.string(),
  items: z.array(CartLine),
  itemCount: z.number().int().min(0),
  subtotalCents: Cents,
});
export type Cart = z.infer<typeof Cart>;

export const NegotiationStatus = z.enum([
  "awaiting_seller",
  "awaiting_customer",
  "accepted",
  "rejected",
  "cancelled",
  "expired",
  "ordered",
]);
export type NegotiationStatus = z.infer<typeof NegotiationStatus>;

export const NegotiationLine = z.object({
  productId: Id,
  name: z.string(),
  quantity: Quantity,
  listUnitPriceCents: PositiveCents,
});
export type NegotiationLine = z.infer<typeof NegotiationLine>;

export const PriceLine = z.object({ productId: Id, unitPriceCents: PositiveCents });
export type PriceLine = z.infer<typeof PriceLine>;

export const NegotiationRound = z.object({
  n: z.number().int().min(1),
  by: z.enum(["customer", "seller"]),
  action: z.enum(["offer", "counter", "accept", "reject"]),
  lines: z.array(PriceLine),
  message: z.string().nullable(),
  createdAt: Timestamp,
});
export type NegotiationRound = z.infer<typeof NegotiationRound>;

export const AgreedLine = z.object({
  productId: Id,
  quantity: Quantity,
  unitPriceCents: PositiveCents,
});
export type AgreedLine = z.infer<typeof AgreedLine>;

const PartyRef = z.object({ name: z.string(), company: z.string() });

export const Negotiation = z.object({
  id: Id,
  status: NegotiationStatus,
  currency: z.string(),
  customer: PartyRef,
  lines: z.array(NegotiationLine).min(1),
  rounds: z.array(NegotiationRound),
  customerRoundsLeft: z.number().int().min(0),
  agreedLines: z.array(AgreedLine).nullable(),
  agreedTotalCents: Cents.nullable(),
  savingsCents: Cents.nullable(),
  expiresAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Negotiation = z.infer<typeof Negotiation>;

export const NegotiationSummary = z.object({
  id: Id,
  status: NegotiationStatus,
  customer: PartyRef,
  itemCount: z.number().int().min(0),
  listTotalCents: Cents,
  latestPriceTotalCents: Cents,
  expiresAt: Timestamp,
  updatedAt: Timestamp,
});
export type NegotiationSummary = z.infer<typeof NegotiationSummary>;

export const OrderStatus = z.enum(["confirmed", "processing", "shipped", "delivered", "cancelled"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const OrderLine = z.object({
  productId: Id,
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  quantity: Quantity,
  listUnitPriceCents: PositiveCents,
  unitPriceCents: PositiveCents,
  negotiated: z.boolean(),
});
export type OrderLine = z.infer<typeof OrderLine>;

export const ShippingAddress = Address.omit({ id: true, isDefault: true });
export type ShippingAddress = z.infer<typeof ShippingAddress>;

export const Order = z.object({
  id: Id,
  /** Human-facing order number (the mock uses TP-2026-1004; any format is fine). */
  number: z.string().min(1).max(64),
  status: OrderStatus,
  negotiationId: Id.nullable(),
  currency: z.string(),
  lines: z.array(OrderLine).min(1),
  subtotalCents: Cents,
  discountCents: Cents,
  shippingCents: Cents,
  taxCents: Cents,
  totalCents: Cents,
  shippingAddress: ShippingAddress,
  createdAt: Timestamp,
});
export type Order = z.infer<typeof Order>;

export const OrderSummary = z.object({
  id: Id,
  number: z.string(),
  status: OrderStatus,
  itemCount: z.number().int().min(1),
  totalCents: Cents,
  negotiated: z.boolean(),
  savingsCents: Cents,
  createdAt: Timestamp,
});
export type OrderSummary = z.infer<typeof OrderSummary>;

export const QrStatus = z.enum(["pending", "scanned", "approved", "denied", "expired", "consumed"]);
export type QrStatus = z.infer<typeof QrStatus>;

// Request bodies and queries

export const LoginBody = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const QrCodeBody = z.object({ code: z.string().min(1).max(200) });
export type QrCodeBody = z.infer<typeof QrCodeBody>;

export const QrApproveBody = QrCodeBody.extend({ decision: z.enum(["approve", "deny"]) });
export type QrApproveBody = z.infer<typeof QrApproveBody>;

export const ProductSort = z.enum(["name", "price_asc", "price_desc", "newest"]);
export const ProductQuery = z.object({
  category: Slug.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: ProductSort.default("name"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type ProductQuery = z.infer<typeof ProductQuery>;
export const PRODUCT_PAGE_SIZE = 24;

export const AddCartItemBody = z.object({ productId: Id, quantity: Quantity });
export type AddCartItemBody = z.infer<typeof AddCartItemBody>;

export const UpdateCartItemBody = z.object({ quantity: Quantity });
export type UpdateCartItemBody = z.infer<typeof UpdateCartItemBody>;

export const CreateNegotiationBody = z.object({
  lines: z.array(PriceLine).min(1).max(100),
  message: Message,
});
export type CreateNegotiationBody = z.infer<typeof CreateNegotiationBody>;

export const CustomerRoundBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("offer"), lines: z.array(PriceLine).min(1).max(100), message: Message }),
  z.object({ action: z.literal("accept"), message: Message }),
  z.object({ action: z.literal("reject"), message: Message }),
]);
export type CustomerRoundBody = z.infer<typeof CustomerRoundBody>;

export const SellerRoundBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("counter"), lines: z.array(PriceLine).min(1).max(100), message: Message }),
  z.object({ action: z.literal("accept"), message: Message }),
  z.object({ action: z.literal("reject"), message: Message }),
]);
export type SellerRoundBody = z.infer<typeof SellerRoundBody>;

export const SellerListQuery = z.object({ status: NegotiationStatus.optional() });
export type SellerListQuery = z.infer<typeof SellerListQuery>;

export const PlaceOrderBody = z.object({
  shippingAddressId: Id,
  negotiationId: Id.nullish(),
});
export type PlaceOrderBody = z.infer<typeof PlaceOrderBody>;

export const IdempotencyKey = z.uuid();

export const OrderListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type OrderListQuery = z.infer<typeof OrderListQuery>;

// Response bodies

export const UserResponse = z.object({ user: User });
export const OkResponse = z.object({ ok: z.literal(true) });
export const QrCreateResponse = z.object({ id: Id, approveUrl: z.url(), expiresAt: Timestamp });
export const QrStatusResponse = z.object({ status: QrStatus, expiresAt: Timestamp });
export const QrScanResponse = z.object({ requestedFrom: z.string(), requestedAt: Timestamp });
export const QrApproveResponse = z.object({ status: z.enum(["approved", "denied"]) });
export const CategoriesResponse = z.object({ categories: z.array(CategoryNode) });
export const ProductsResponse = z.object({
  items: z.array(ProductListItem),
  page: z.number().int().min(1),
  pageSize: z.number().int(),
  total: z.number().int().min(0),
});
export type ProductsResponse = z.infer<typeof ProductsResponse>;
export const ProductResponse = z.object({ product: Product });
export const SellerNegotiationsResponse = z.object({ items: z.array(NegotiationSummary) });
export const OrderResponse = z.object({ order: Order });
export const OrdersResponse = z.object({ items: z.array(OrderSummary) });
