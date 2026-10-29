from datetime import UTC, datetime, timedelta

from routing.services.planner import Checkpoint, RoutePlan, checkpoint_miles, explain
from routing.services.risk import RiskLevel
from routing.services.routing import RawRoute

DEPARTURE = datetime(2026, 1, 1, tzinfo=UTC)


def make_plan(name: str, hours: float, avg: float = 0.0, **miles: float) -> RoutePlan:
    route = RawRoute(points=[(0, 0), (1, 1)], cumulative_m=[0, 1], cumulative_s=[0, hours * 3600], via="")
    plan = RoutePlan(
        route=route,
        checkpoints=[Checkpoint(0, (0, 0), DEPARTURE)],
        arrival=DEPARTURE + timedelta(hours=hours),
        name=name,
    )
    plan.miles_by_level = {RiskLevel[k.upper()]: v for k, v in miles.items()}
    plan.avg_risk = avg
    return plan


def rank(*plans: RoutePlan) -> list[str]:
    return [p.name for p in sorted(plans, key=RoutePlan.sort_key)]


def test_checkpoint_miles_include_both_ends():
    assert checkpoint_miles(60.0, 25) == [0, 25, 50, 60.0]


def test_checkpoint_miles_drop_sliver_before_destination():
    assert checkpoint_miles(52.0, 25) == [0, 25, 52.0]


def test_fewest_severe_miles_wins_over_speed():
    fast = make_plan("Route A", 10, severe=25)
    slow = make_plan("Route B", 14, high=300)
    assert rank(fast, slow) == ["Route B", "Route A"]


def test_high_miles_break_severe_tie():
    a = make_plan("Route A", 10, severe=10, high=50)
    b = make_plan("Route B", 12, severe=10, high=20)
    assert rank(a, b) == ["Route B", "Route A"]


def test_average_risk_then_time():
    a = make_plan("Route A", 10, avg=0.4)
    b = make_plan("Route B", 12, avg=0.2)
    c = make_plan("Route C", 11, avg=0.2)
    assert rank(a, b, c) == ["Route C", "Route B", "Route A"]


def test_no_travel_ranks_below_severe():
    a = make_plan("Route A", 10, no_travel=10)
    b = make_plan("Route B", 12, severe=200)
    assert rank(a, b) == ["Route B", "Route A"]


def test_explanation_names_deciding_criterion_and_time_cost():
    fast = make_plan("Route A", 10, severe=25)
    slow = make_plan("Route B", 12)
    reason = explain([slow, fast])
    assert "fewest Severe miles (0 vs 25 on Route A)" in reason
    assert "2.0 h longer than Route A" in reason
