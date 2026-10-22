//! Python bindings for workclock, built by maturin as `workclock._workclock`.

use pyo3::prelude::*;

#[pymodule]
mod _workclock {
    use pyo3::prelude::*;

    #[pymodule_init]
    fn init(m: &Bound<'_, PyModule>) -> PyResult<()> {
        m.add("__version__", env!("CARGO_PKG_VERSION"))
    }
}
