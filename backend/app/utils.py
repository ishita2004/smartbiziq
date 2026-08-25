import os
import math
import time
from typing import Dict, Any, Optional

class MemoryCache:
    """Zero-cost local in-memory cache replacing external Redis dependency."""
    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        if key in self._store:
            item = self._store[key]
            if item["expires_at"] is None or item["expires_at"] > time.time():
                return item["value"]
            else:
                del self._store[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = 300):
        expires_at = time.time() + ttl_seconds if ttl_seconds else None
        self._store[key] = {"value": value, "expires_at": expires_at}

    def clear(self):
        self._store.clear()

cache = MemoryCache()

def format_currency(amount: float) -> str:
    return f"${amount:,.2f}"

def format_percentage(val: float) -> str:
    return f"{val:.1f}%"
