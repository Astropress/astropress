/**
 * Tiny Result<T, E> + Option<T> helpers — no library dependency.
 *
 * Used at module boundaries that previously returned Record<string, unknown>
 * or threw raw errors. The discovery audit (audit-boundary-types) ratchets
 * a grandfathered count of weak-typed exports; new code should reach for
 * Result/Option instead of unknown bags.
 *
 * Construct with ok / err / some / none. Narrow with `if (r.ok)` or
 * `if (o.some)` — the discriminant is a literal boolean for cheap inference.
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export type Some<T> = { some: true; value: T };
export type None = { some: false };
export type Option<T> = Some<T> | None;

export function ok<T>(value: T): Ok<T> {
	return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
	return { ok: false, error };
}

export function some<T>(value: T): Some<T> {
	return { some: true, value };
}

export const none: None = { some: false };

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
	return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
	return !r.ok;
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
	return r.ok ? r.value : fallback;
}

export function mapResult<T, U, E>(
	r: Result<T, E>,
	f: (v: T) => U,
): Result<U, E> {
	return r.ok ? ok(f(r.value)) : r;
}
