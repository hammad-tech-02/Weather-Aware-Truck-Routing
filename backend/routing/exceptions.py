import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class UpstreamError(Exception):
    """A third-party provider (routing, weather, geocoding) failed or returned nothing usable."""

    def __init__(self, service: str, message: str, status_code: int | None = None):
        super().__init__(f"{service}: {message}")
        self.service = service
        self.message = message
        self.status_code = status_code


def api_exception_handler(exc, context):
    if isinstance(exc, UpstreamError):
        logger.warning("upstream failure: %s", exc)
        return Response({"error": exc.message}, status=status.HTTP_502_BAD_GATEWAY)

    response = exception_handler(exc, context)
    if response is not None and "error" not in response.data:
        response.data = {"error": _first_message(response.data), "details": response.data}
    return response


def _first_message(data, field: str | None = None) -> str:
    """Flatten DRF's nested error structure into one human-readable line."""
    if isinstance(data, dict):
        if "detail" in data:
            return str(data["detail"])
        key, value = next(iter(data.items()))
        return _first_message(value, None if key == "non_field_errors" else key)
    if isinstance(data, list) and data:
        return _first_message(data[0], field)
    label = field.replace("_", " ").capitalize() if field else None
    return f"{label}: {data}" if label else str(data)
