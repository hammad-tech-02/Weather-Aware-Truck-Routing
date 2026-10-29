"""FMCSA hours-of-service applied to ETAs.

A property-carrying driver may drive 11 hours before a 10-hour off-duty rest,
and needs a 30-minute break after 8 cumulative hours of driving. Ignoring this
puts a 1,000-mile trip's later checkpoints ~10 hours early, which means
sampling the wrong forecast hour, so it matters for correctness here.
"""

from dataclasses import dataclass

HOUR = 3600
DRIVE_LIMIT_S = 11 * HOUR
BREAK_AFTER_S = 8 * HOUR
BREAK_S = 0.5 * HOUR
REST_S = 10 * HOUR


@dataclass(frozen=True)
class Stop:
    kind: str  # "break" | "rest"
    drive_s: float
    duration_s: float


def stops_before(drive_s: float) -> list[Stop]:
    """Mandatory stops the driver takes before accumulating `drive_s` of driving."""
    stops: list[Stop] = []
    shift_start = 0.0
    while shift_start < drive_s:
        if shift_start > 0:
            stops.append(Stop("rest", shift_start, REST_S))
        if shift_start + BREAK_AFTER_S < drive_s:
            stops.append(Stop("break", shift_start + BREAK_AFTER_S, BREAK_S))
        shift_start += DRIVE_LIMIT_S
    return stops


def elapsed_s(drive_s: float) -> float:
    """Wall-clock seconds from departure until `drive_s` of driving is done."""
    return drive_s + sum(stop.duration_s for stop in stops_before(drive_s))
