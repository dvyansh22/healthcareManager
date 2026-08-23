from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ServiceTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = request.headers.get("X-Service-Token")
        if not token:
            return None
        if token != settings.SERVICE_TOKEN:
            raise AuthenticationFailed("Invalid service token")
        return (None, None)
