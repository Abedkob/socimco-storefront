import { z } from "zod";

export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 403,
  RATE_LIMITED: 429,
  QR_EXPIRED: 410,
  QR_ALREADY_USED: 410,
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  INTERNAL: 500,
  QUANTITY_INVALID: 422,
  OUT_OF_STOCK: 409,
  CART_EMPTY: 409,
  CART_LOCKED: 409,
  NEGOTIATION_NOT_ELIGIBLE: 422,
  NEGOTIATION_INVALID_PRICE: 422,
  NEGOTIATION_NO_ROUNDS_LEFT: 409,
  NEGOTIATION_NOT_YOUR_TURN: 409,
  NEGOTIATION_NOT_ACCEPTED: 409,
  NEGOTIATION_EXPIRED: 409,
  NEGOTIATION_CLOSED: 409,
  ADDRESS_NOT_FOUND: 404,
  IDEMPOTENCY_KEY_REQUIRED: 400,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** What the customer reads for each error. The storefront is French only. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Veuillez vous connecter pour continuer.",
  FORBIDDEN: "Vous n'avez pas accès à cette page.",
  INVALID_CREDENTIALS: "Identifiant ou mot de passe incorrect.",
  ACCOUNT_DISABLED: "Ce compte est désactivé. Contactez SOCIMCO.",
  RATE_LIMITED: "Trop de tentatives. Patientez puis réessayez.",
  QR_EXPIRED: "Ce QR code a expiré.",
  QR_ALREADY_USED: "Ce QR code a déjà été utilisé.",
  VALIDATION_FAILED: "Certains champs sont invalides.",
  NOT_FOUND: "Introuvable.",
  INTERNAL: "Une erreur est survenue. Veuillez réessayer.",
  QUANTITY_INVALID: "Cette quantité ne peut pas être commandée.",
  OUT_OF_STOCK: "Stock insuffisant pour cette quantité.",
  CART_EMPTY: "Votre panier est vide.",
  CART_LOCKED: "Annulez le devis en cours avant de modifier votre panier.",
  NEGOTIATION_NOT_ELIGIBLE: "Ces articles ne peuvent pas être négociés.",
  NEGOTIATION_INVALID_PRICE: "Ce prix est en dehors de la fourchette autorisée.",
  NEGOTIATION_NO_ROUNDS_LEFT: "Plus d'offre possible. Acceptez ou refusez le dernier prix.",
  NEGOTIATION_NOT_YOUR_TURN: "En attente de la réponse de l'autre partie.",
  NEGOTIATION_NOT_ACCEPTED: "Le prix négocié n'a pas été accepté.",
  NEGOTIATION_EXPIRED: "Ce devis a expiré.",
  NEGOTIATION_CLOSED: "Ce devis est clôturé.",
  ADDRESS_NOT_FOUND: "Adresse de livraison introuvable.",
  IDEMPOTENCY_KEY_REQUIRED: "En-tête Idempotency-Key manquant.",
};

const ERROR_CODES = Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]];

export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, options: { message?: string; details?: unknown } = {}) {
    super(options.message ?? ERROR_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.details = options.details;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toEnvelope(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

/**
 * Also recognises an ApiError created by an older copy of this module. In `next dev`, the mock backend is kept
 * on globalThis across hot reloads, so its errors can come from a previous version of this class.
 */
export function isApiError(value: unknown): value is ApiError {
  if (value instanceof ApiError) return true;
  if (!(value instanceof Error) || value.name !== "ApiError") return false;
  const v = value as Error & { code?: unknown; toEnvelope?: unknown };
  return typeof v.code === "string" && Object.hasOwn(ERROR_STATUS, v.code) && typeof v.toEnvelope === "function";
}
