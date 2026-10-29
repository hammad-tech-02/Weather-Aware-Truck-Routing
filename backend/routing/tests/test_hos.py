from routing.services import hos

H = 3600


def test_short_trip_has_no_stops():
    assert hos.elapsed_s(8 * H) == 8 * H


def test_break_after_eight_hours():
    assert hos.elapsed_s(9 * H) == 9.5 * H


def test_rest_after_eleven_hours():
    # 30 min break at 8h, 10h rest at 11h
    assert hos.elapsed_s(12 * H) == 12 * H + 0.5 * H + 10 * H


def test_arriving_exactly_at_limit_needs_no_rest():
    assert [s.kind for s in hos.stops_before(11 * H)] == ["break"]


def test_two_day_trip_stop_sequence():
    stops = hos.stops_before(20 * H)
    assert [(s.kind, s.drive_s / H) for s in stops] == [("break", 8), ("rest", 11), ("break", 19)]
