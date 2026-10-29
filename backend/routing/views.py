from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from routing.serializers import HeatmapRequestSerializer, PlanRequestSerializer
from routing.services.geocoding import search_places
from routing.services.heatmap import build_heatmap
from routing.services.planner import plan_trip


@api_view(["GET"])
def geocode(request: Request) -> Response:
    query = request.query_params.get("q", "").strip()
    if len(query) < 3:
        return Response({"results": []})
    return Response({"results": search_places(query)})


@api_view(["POST"])
def plan(request: Request) -> Response:
    serializer = PlanRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    result = plan_trip(
        origin=(data["origin"]["lat"], data["origin"]["lon"]),
        destination=(data["destination"]["lat"], data["destination"]["lon"]),
        departure=data["departure_time"],
        load_lbs=data["load_lbs"],
        interval_mi=int(data["checkpoint_interval_mi"]),
    )
    return Response(result)


@api_view(["POST"])
def heatmap(request: Request) -> Response:
    serializer = HeatmapRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    points = [(lat, lon) for lat, lon in data["points"]]
    return Response(build_heatmap(points, data["start_time"], data["load_lbs"]))


@api_view(["GET"])
def health(_request: Request) -> Response:
    return Response({"status": "ok"})
