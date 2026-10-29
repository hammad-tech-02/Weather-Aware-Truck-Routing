from datetime import UTC, datetime, timedelta

from rest_framework import serializers

MAX_LOAD_LBS = 80_000
MAX_HEATMAP_POINTS = 400


class PlaceSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=200, required=False, allow_blank=True)
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)


class PlanRequestSerializer(serializers.Serializer):
    origin = PlaceSerializer()
    destination = PlaceSerializer()
    departure_time = serializers.DateTimeField()
    load_lbs = serializers.FloatField(min_value=0, max_value=MAX_LOAD_LBS)
    checkpoint_interval_mi = serializers.ChoiceField(choices=[10, 25, 50])

    def validate_departure_time(self, value: datetime) -> datetime:
        now = datetime.now(UTC)
        if value < now - timedelta(hours=1):
            raise serializers.ValidationError("Departure must not be in the past.")
        if value > now + timedelta(days=7):
            raise serializers.ValidationError("Departure must be within the next 7 days (forecast range).")
        return value.astimezone(UTC)

    def validate(self, attrs):
        o, d = attrs["origin"], attrs["destination"]
        if abs(o["lat"] - d["lat"]) < 1e-4 and abs(o["lon"] - d["lon"]) < 1e-4:
            raise serializers.ValidationError("Origin and destination must be different.")
        return attrs


class HeatmapRequestSerializer(serializers.Serializer):
    points = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2),
        min_length=1,
        max_length=MAX_HEATMAP_POINTS,
    )
    start_time = serializers.DateTimeField()
    load_lbs = serializers.FloatField(min_value=0, max_value=MAX_LOAD_LBS)

    def validate_start_time(self, value: datetime) -> datetime:
        if value > datetime.now(UTC) + timedelta(days=8):
            raise serializers.ValidationError("Start time is beyond the forecast range.")
        return value.astimezone(UTC)
