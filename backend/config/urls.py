from django.urls import include, path, re_path

from config.views import spa

urlpatterns = [
    path("api/", include("routing.urls")),
    re_path(r"^(?!api/).*$", spa),
]
