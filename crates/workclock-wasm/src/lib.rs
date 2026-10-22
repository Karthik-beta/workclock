//! WebAssembly bindings for workclock, built with wasm-pack into the `workclock`
//! npm package.

use wasm_bindgen::prelude::*;

/// Returns the workclock version this module was built from.
#[wasm_bindgen]
#[must_use]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}
