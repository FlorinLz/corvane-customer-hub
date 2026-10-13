// Brief 3.1.1 / 3.1.3. One error class per failure response `handle()` maps
// to a status code and JSON body.
export class ValidationError extends Error {
  readonly status = 400;
  constructor(public fieldErrors: Record<string, string[]>) {
    super("validation");
  }
}

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor() {
    super("unauthenticated");
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(public ownerTeam: string) {
    super("forbidden");
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("not_found");
  }
}

export class ConflictError extends Error {
  readonly status = 409;
  constructor(
    public message: string,
    public needsConfirmation = false,
  ) {
    super("conflict");
  }
}

export class DeletedError extends Error {
  readonly status = 410;
  constructor() {
    super("deleted");
  }
}

export class GleifUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super("gleif_unavailable");
  }
}

/**
 * Brief 4.9.12. Issue-flow 403s carry a specific code and message instead
 * of the matrix's generic owner_team shape, since the gate is a person
 * check (owner, communicator, reporter), not a team cell.
 */
export class IssueForbiddenError extends Error {
  readonly status = 403;
  constructor(
    public code: "not_issue_owner" | "not_communicator" | "not_reporter" | "issue_type_changed" | "linked_follows_parent" | "communication_handed_over",
    message: string,
  ) {
    super(message);
  }
}
