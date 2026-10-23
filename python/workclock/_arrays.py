"""NumPy support for the batch API, without depending on NumPy.

NumPy is imported only when an array is passed in. ``datetime64`` values are
naive, so they are read and returned as UTC.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import numpy as np
    from numpy.typing import NDArray
    from typing_extensions import TypeGuard


def is_array(value: object) -> TypeGuard[NDArray[Any]]:
    """Return whether ``value`` is a NumPy array."""
    kind = type(value)
    return kind.__module__ == "numpy" and kind.__name__ == "ndarray"


def to_micros(values: object, unit: str, shape: tuple[int, ...]) -> list[int]:
    """Return ``values`` as integer microseconds, broadcast to ``shape``."""
    import numpy as np

    array: NDArray[Any] = np.broadcast_to(
        np.asarray(values, dtype=f"{unit}[us]"), shape
    )
    if np.isnat(array).any():
        raise ValueError("batch inputs must not contain NaT")
    result: list[int] = array.astype(np.int64).ravel().tolist()
    return result


def from_micros(micros: list[int], unit: str, shape: tuple[int, ...]) -> NDArray[Any]:
    """Return integer microseconds as an array of ``unit`` with ``shape``."""
    import numpy as np

    array: NDArray[np.int64] = np.array(micros, dtype=np.int64).reshape(shape)
    return array.astype(f"{unit}[us]")
