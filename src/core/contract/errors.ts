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

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Please log in to continue.",
  FORBIDDEN: "You don't have access to this.",
  INVALID_CREDENTIALS: "Username or password is incorrect.",
  ACCOUNT_DISABLED: "This account is disabled. Contact the shop.",
  RATE_LIMITED: "Too many attempts. Please wait and try again.",
  QR_EXPIRED: "This QR code has expired.",
  QR_ALREADY_USED: "This QR code has already been used.",
  VALIDATION_FAILED: "Some fields are invalid.",
  NOT_FOUND: "Not found.",
  INTERNAL: "Something went wrong. Please try again.",
  QUANTITY_INVALID: "This quantity can't be ordered.",
  OUT_OF_STOCK: "Not enough stock for this quantity.",
  CART_EMPTY: "Your cart is empty.",
  CART_LOCKED: "Cancel the open negotiation before changing your cart.",
  NEGOTIATION_NOT_ELIGIBLE: "These items can't be negotiated.",
  NEGOTIATION_INVALID_PRICE: "That price is outside the allowed range.",
  NEGOTIATION_NO_ROUNDS_LEFT: "No offers left. Accept or reject the last price.",
  NEGOTIATION_NOT_YOUR_TURN: "Waiting for the other side to respond.",
  NEGOTIATION_NOT_ACCEPTED: "The negotiated price hasn't been accepted.",
  NEGOTIATION_EXPIRED: "This negotiation has expired.",
  NEGOTIATION_CLOSED: "This negotiation is closed.",
  ADDRESS_NOT_FOUND: "Shipping address not found.",
  IDEMPOTENCY_KEY_REQUIRED: "Missing Idempotency-Key header.",
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

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
