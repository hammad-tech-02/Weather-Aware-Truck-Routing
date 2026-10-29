"""Shared HTTP session for third-party providers: pooled connections, retries on 429/5xx."""

from functools import lru_cache
from typing import Any

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from routing.exceptions import UpstreamError


@lru_cache(maxsize=1)
def session() -> requests.Session:
    retry = Retry(total=3, backoff_factor=0.5, status_forcelist=(429, 500, 502, 503, 504))
    adapter = HTTPAdapter(max_retries=retry, pool_connections=16, pool_maxsize=16)
    s = requests.Session()
    s.headers["User-Agent"] = settings.HTTP_USER_AGENT
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


def get_json(service: str, url: str, params: dict[str, Any] | None = None) -> Any:
    try:
        response = session().get(url, params=params, timeout=settings.HTTP_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise UpstreamError(service, f"{service} is unreachable, please retry.") from exc
    if response.status_code >= 400:
        raise UpstreamError(service, f"{service} returned HTTP {response.status_code}.", response.status_code)
    return response.json()
