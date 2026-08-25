from app.utils import cache

class CacheService:
    @staticmethod
    def get(key: str):
        return cache.get(key)

    @staticmethod
    def set(key: str, value: any, ttl_seconds: int = 300):
        cache.set(key, value, ttl_seconds)

    @staticmethod
    def clear():
        cache.clear()
