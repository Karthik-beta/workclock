__version__: str

_Time = tuple[int, int, int, int]
_Hours = tuple[_Time, _Time, list[int], str | None]
_Holidays = tuple[list[tuple[int, int, int]], str | None]

class EngineError(Exception): ...

class Schedule:
    def __init__(
        self,
        zone: str | None,
        workdays: list[_Hours],
        breaks: list[_Hours],
        holidays: list[_Holidays],
    ) -> None: ...
    def between(self, a: int, b: int) -> int: ...
    def add(self, t: int, d: int) -> int: ...
    def sub(self, t: int, d: int) -> int: ...
