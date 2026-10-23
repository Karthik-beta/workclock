// The WebAssembly module throws plain `Error` objects carrying a `kind`, so
// besides the usual prototype check these classes recognise errors by `kind`.
// That also keeps `instanceof` working across the node, bundler and web builds.

function isInstance(Class, value, kinds) {
  return (
    Function.prototype[Symbol.hasInstance].call(Class, value) ||
    (value instanceof Error && kinds.includes(value.kind))
  );
}

export class WorkclockError extends Error {
  name = "WorkclockError";
  kind = "unknown";

  static [Symbol.hasInstance](value) {
    return isInstance(this, value, ["no_working_time", "out_of_range", "unknown_zone", "unknown"]);
  }
}

export class NoWorkingTimeError extends WorkclockError {
  name = "NoWorkingTimeError";
  kind = "no_working_time";

  static [Symbol.hasInstance](value) {
    return isInstance(this, value, ["no_working_time"]);
  }
}

export class OutOfRangeError extends WorkclockError {
  name = "OutOfRangeError";
  kind = "out_of_range";

  static [Symbol.hasInstance](value) {
    return isInstance(this, value, ["out_of_range"]);
  }
}

export class UnknownZoneError extends WorkclockError {
  name = "UnknownZoneError";
  kind = "unknown_zone";

  static [Symbol.hasInstance](value) {
    return isInstance(this, value, ["unknown_zone"]);
  }
}
