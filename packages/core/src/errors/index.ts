export interface AuthErrorOptions {
  code: string;
  statusCode?: number;
  cause?: unknown;
}

export class AuthError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly cause?: unknown;

  constructor(message: string, options: AuthErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.cause = options.cause;
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode
    };
  }
}

export class AuthConfigError extends AuthError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: "AUTH_CONFIG_ERROR", statusCode: 500, cause });
  }
}

export class AuthAdapterError extends AuthError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: "AUTH_ADAPTER_ERROR", statusCode: 500, cause });
  }
}

export class AuthAdapterNotFoundError extends AuthAdapterError {
  constructor(message = "The requested auth entity was not found.") {
    super(message);
  }
}

export class AuthSessionError extends AuthError {}

export class SessionExpiredError extends AuthSessionError {
  constructor(message = "The session token has expired. Please sign in again.") {
    super(message, { code: "SESSION_EXPIRED", statusCode: 401 });
  }
}

export class SessionNotFoundError extends AuthSessionError {
  constructor(message = "No valid session was found.") {
    super(message, { code: "SESSION_NOT_FOUND", statusCode: 401 });
  }
}

export class AuthTokenError extends AuthError {}

export class TokenExpiredError extends AuthTokenError {
  constructor(message = "The token has expired.") {
    super(message, { code: "TOKEN_EXPIRED", statusCode: 401 });
  }
}

export class TokenInvalidError extends AuthTokenError {
  constructor(message = "The token is invalid.") {
    super(message, { code: "TOKEN_INVALID", statusCode: 401 });
  }
}

export class TokenRevokedError extends AuthTokenError {
  constructor(message = "The token has been revoked.") {
    super(message, { code: "TOKEN_REVOKED", statusCode: 401 });
  }
}

export class AuthCredentialsError extends AuthError {
  constructor(message = "Invalid email or password.") {
    super(message, { code: "INVALID_CREDENTIALS", statusCode: 401 });
  }
}

export class AuthOAuthError extends AuthError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: "OAUTH_ERROR", statusCode: 400, cause });
  }
}

export class OAuthStateMismatchError extends AuthOAuthError {
  constructor() {
    super("The OAuth state value did not match.");
  }
}

export class OAuthProviderError extends AuthOAuthError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class AuthRoleError extends AuthError {
  constructor(message = "Insufficient permissions.") {
    super(message, { code: "INSUFFICIENT_ROLE", statusCode: 403 });
  }
}
