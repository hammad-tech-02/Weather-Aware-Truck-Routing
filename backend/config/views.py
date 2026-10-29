from django.conf import settings
from django.http import FileResponse, HttpRequest, HttpResponse


def spa(_request: HttpRequest) -> HttpResponse:
    """Serve the React app's index.html for client-side routes; assets are served by WhiteNoise."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse("Frontend not built. In development run `pnpm dev` in frontend/.", status=404)
    return FileResponse(index.open("rb"), content_type="text/html")
