/** Base class of the errors a schedule throws; check with `instanceof`. */
export declare class WorkclockError extends Error {
  readonly kind: string;
}

/** No working time was found within the search bound, or a rule set has none. */
export declare class NoWorkingTimeError extends WorkclockError {
  readonly kind: "no_working_time";
}

/** A result falls outside the supported range of years -9999 to 9999. */
export declare class OutOfRangeError extends WorkclockError {
  readonly kind: "out_of_range";
}

/** A time zone name is not in the IANA database. */
export declare class UnknownZoneError extends WorkclockError {
  readonly kind: "unknown_zone";
}
