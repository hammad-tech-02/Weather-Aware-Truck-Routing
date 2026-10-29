"""Weather risk classification for a single checkpoint.

Thresholds come straight from the assessment brief. Lower bounds are inclusive
(e.g. 0.25 in/hr of rain is High, not Moderate), upper bounds of the last
bounded band are inclusive (1.00 in/hr is Severe; anything above is No Travel).
"""

from dataclasses import dataclass
from enum import IntEnum


class RiskLevel(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()


@dataclass(frozen=True)
class Weather:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float


@dataclass(frozen=True)
class RiskAssessment:
    level: RiskLevel
    wind: RiskLevel
    rain: RiskLevel
    snow: RiskLevel
    reasons: tuple[str, ...]


HEAVY_LOAD_LBS = 30_000
VERY_HEAVY_LOAD_LBS = 40_000


def classify_wind(wind_mph: float) -> RiskLevel:
    if wind_mph >= 55:
        return RiskLevel.NO_TRAVEL
    if wind_mph >= 45:
        return RiskLevel.SEVERE
    if wind_mph >= 35:
        return RiskLevel.HIGH
    if wind_mph >= 25:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_rain(rain_in_hr: float) -> RiskLevel:
    if rain_in_hr > 1.0:
        return RiskLevel.NO_TRAVEL
    if rain_in_hr >= 0.5:
        return RiskLevel.SEVERE
    if rain_in_hr >= 0.25:
        return RiskLevel.HIGH
    if rain_in_hr >= 0.10:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_snow(snow_in_hr: float) -> RiskLevel:
    if snow_in_hr > 3.0:
        return RiskLevel.NO_TRAVEL
    if snow_in_hr >= 2.0:
        return RiskLevel.SEVERE
    if snow_in_hr >= 1.0:
        return RiskLevel.HIGH
    if snow_in_hr >= 0.5:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def apply_load_rules(wind_level: RiskLevel, load_lbs: float) -> RiskLevel:
    """Heavier trucks are escalated in high wind (rollover / jackknife risk)."""
    if wind_level == RiskLevel.SEVERE and load_lbs > HEAVY_LOAD_LBS:
        return RiskLevel.NO_TRAVEL
    if wind_level == RiskLevel.HIGH and load_lbs > VERY_HEAVY_LOAD_LBS:
        return RiskLevel.SEVERE
    return wind_level


def assess(weather: Weather, load_lbs: float) -> RiskAssessment:
    base_wind = classify_wind(weather.wind_mph)
    wind = apply_load_rules(base_wind, load_lbs)
    rain = classify_rain(weather.rain_in_hr)
    snow = classify_snow(weather.snow_in_hr)
    level = max(wind, rain, snow)

    reasons: list[str] = []
    if wind > RiskLevel.LOW:
        note = f"Wind {weather.wind_mph:.0f} mph"
        if wind != base_wind:
            note += f" with {load_lbs:,.0f} lb load"
        reasons.append(f"{note} → {wind.label}")
    if rain > RiskLevel.LOW:
        reasons.append(f"Rain {weather.rain_in_hr:.2f} in/hr → {rain.label}")
    if snow > RiskLevel.LOW:
        reasons.append(f"Snow {weather.snow_in_hr:.2f} in/hr → {snow.label}")

    return RiskAssessment(level=level, wind=wind, rain=rain, snow=snow, reasons=tuple(reasons))
