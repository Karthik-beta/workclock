/**
 * Base class of the errors a schedule throws; check with `instanceof`.
 *
 * Malformed input, such as a rule without `start` or an instant string
 * without a UTC offset, throws a built-in `TypeError` or `RangeError`
 * instead, which is not a `WorkclockError`.
 */
export declare class WorkclockError extends Error {
  /**
   * `"no_working_time"`, `"out_of_range"` or `"unknown_zone"` for the
   * subclasses below, or `"unknown"` for an error this version does not
   * classify further.
   */
  readonly kind: string;
}

/**
 * The rules have no working time, or a search found none within 366 days,
 * plus one day per holiday date.
 */
export declare class NoWorkingTimeError extends WorkclockError {
  readonly kind: "no_working_time";
}

/**
 * An instant falls outside the supported range, -009999-01-02T01:59:59Z to
 * 9999-12-30T22:00:00Z.
 */
export declare class OutOfRangeError extends WorkclockError {
  readonly kind: "out_of_range";
}

/** A time zone name is not in the IANA database. */
export declare class UnknownZoneError extends WorkclockError {
  readonly kind: "unknown_zone";
}
