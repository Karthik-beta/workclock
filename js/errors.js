// The WebAssembly module throws plain `Error` objects carrying a `kind`, so
// these classes recognise errors by `kind` rather than by prototype. That also
// keeps `instanceof` working across the node, bundler and web builds.

function hasKind(value, kinds) {
  return value instanceof Error && kinds.includes(value.kind);
}

export class WorkclockError extends Error {
  static [Symbol.hasInstance](value) {
    return hasKind(value, ["no_working_time", "out_of_range", "unknown_zone", "unknown"]);
  }
}

export class NoWorkingTimeError extends WorkclockError {
  static [Symbol.hasInstance](value) {
    return hasKind(value, ["no_working_time"]);
  }
}

export class OutOfRangeError extends WorkclockError {
  static [Symbol.hasInstance](value) {
    return hasKind(value, ["out_of_range"]);
  }
}

export class UnknownZoneError extends WorkclockError {
  static [Symbol.hasInstance](value) {
    return hasKind(value, ["unknown_zone"]);
  }
}
