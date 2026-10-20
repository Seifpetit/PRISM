export class ProductContextDomainError extends Error {
  constructor(code, message, { cause, details } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ProductContextDomainError";
    this.code = code;
    this.details = details ?? null;
  }
}

export class ProductContextValidationError extends Error {
  constructor(issues) {
    super("The AI response does not match the ProductContext contract.");
    this.name = "ProductContextValidationError";
    this.code = "PRODUCT_CONTEXT_SCHEMA_INVALID";
    this.issues = issues;
  }
}
