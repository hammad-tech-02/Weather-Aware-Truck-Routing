import pytest

from routing.services.risk import RiskLevel, Weather, assess, classify_rain, classify_snow, classify_wind

L, M, H, S, N = RiskLevel


@pytest.mark.parametrize(
    ("mph", "expected"),
    [(0, L), (24.9, L), (25, M), (34.9, M), (35, H), (44.9, H), (45, S), (54.9, S), (55, N), (80, N)],
)
def test_wind_thresholds(mph, expected):
    assert classify_wind(mph) == expected


@pytest.mark.parametrize(
    ("inches", "expected"),
    [(0, L), (0.09, L), (0.10, M), (0.24, M), (0.25, H), (0.49, H), (0.50, S), (1.00, S), (1.01, N)],
)
def test_rain_thresholds(inches, expected):
    assert classify_rain(inches) == expected


@pytest.mark.parametrize(
    ("inches", "expected"),
    [(0, L), (0.49, L), (0.5, M), (0.99, M), (1.0, H), (1.99, H), (2.0, S), (3.0, S), (3.01, N)],
)
def test_snow_thresholds(inches, expected):
    assert classify_snow(inches) == expected


@pytest.mark.parametrize(
    ("mph", "load", "expected"),
    [
        (55, 0, N),  # >=55 mph is No Travel for any load
        (50, 30_000, S),  # severe band, load not above 30k
        (50, 30_001, N),  # 45-54 mph + >30,000 lb
        (40, 40_000, H),  # high band, load not above 40k
        (40, 40_001, S),  # 35-44 mph + >40,000 lb
        (40, 35_000, H),  # 30k rule only applies to the 45-54 band
        (30, 80_000, M),  # load rules never touch moderate wind
    ],
)
def test_load_rules(mph, load, expected):
    assert assess(Weather(wind_mph=mph, rain_in_hr=0, snow_in_hr=0), load).level == expected


def test_overall_level_is_worst_condition():
    result = assess(Weather(wind_mph=30, rain_in_hr=0.3, snow_in_hr=2.5), 10_000)
    assert (result.wind, result.rain, result.snow, result.level) == (M, H, S, S)
    assert len(result.reasons) == 3


def test_reason_mentions_load_when_it_escalates():
    result = assess(Weather(wind_mph=40, rain_in_hr=0, snow_in_hr=0), 45_000)
    assert result.reasons == ("Wind 40 mph with 45,000 lb load → Severe",)
