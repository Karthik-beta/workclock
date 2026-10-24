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

_FINER_UNITS = ("ns", "ps", "fs", "as")


def is_array(value: object) -> TypeGuard[NDArray[Any]]:
    """Return whether ``value`` is a NumPy array."""
    kind = type(value)
    return kind.__module__ == "numpy" and kind.__name__ == "ndarray"


def broadcast_shape(a: object, b: object) -> tuple[int, ...]:
    """Return the shape that ``a`` and ``b`` broadcast to under NumPy's rules.

    Raises ``ValueError`` naming both shapes if they do not broadcast.
    """
    import numpy as np

    shapes = np.asarray(a).shape, np.asarray(b).shape
    try:
        return np.broadcast_shapes(*shapes)
    except ValueError:
        raise ValueError(
            f"batch inputs of shapes {shapes[0]} and {shapes[1]} do not "
            "broadcast together"
        ) from None


def to_micros(values: object, unit: str, shape: tuple[int, ...]) -> list[int]:
    """Return ``values`` as integer microseconds, broadcast to ``shape``.

    Raises ``ValueError`` for NaT, and for values with digits below a
    microsecond, which would otherwise be rounded.
    """
    import numpy as np

    given = np.asarray(values)
    converted: NDArray[Any] = np.asarray(values, dtype=f"{unit}[us]")
    array = np.broadcast_to(converted, shape)
    nat = np.flatnonzero(np.isnat(array))
    if nat.size:
        raise ValueError(f"item {nat[0]}: batch inputs must not contain NaT")
    finer = (
        given.dtype.kind in "mM" and np.datetime_data(given.dtype)[0] in _FINER_UNITS
    )
    if finer:
        lossy = np.broadcast_to(converted.astype(given.dtype) != given, shape)
        if lossy.any():
            i = int(np.flatnonzero(lossy)[0])
            value = np.broadcast_to(given, shape).flat[i]
            raise ValueError(f"item {i}: {value!r} has digits below a microsecond")
    result: list[int] = array.astype(np.int64).ravel().tolist()
    return result


def from_micros(micros: list[int], unit: str, shape: tuple[int, ...]) -> NDArray[Any]:
    """Return integer microseconds as an array of ``unit`` with ``shape``."""
    import numpy as np

    array: NDArray[np.int64] = np.array(micros, dtype=np.int64).reshape(shape)
    return array.astype(f"{unit}[us]")
