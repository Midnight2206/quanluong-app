from __future__ import annotations

from abc import ABC, abstractmethod


class BlobStore(ABC):
    @abstractmethod
    def save(self, key: str, content: bytes) -> str | None: ...

    @abstractmethod
    def load(self, key: str) -> bytes: ...


class NullBlobStore(BlobStore):
    def save(self, key: str, content: bytes) -> str | None:
        return None

    def load(self, key: str) -> bytes:
        raise NotImplementedError
