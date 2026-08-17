from __future__ import annotations

import os
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


@lru_cache(maxsize=8)
def _session_factory(database_url: str):
    engine = create_engine(database_url, pool_pre_ping=True)
    return sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Session:
    database_url = (os.environ.get("DOCUMENT_DATABASE_URL") or "").strip()
    if not database_url:
        raise RuntimeError("DOCUMENT_DATABASE_URL is not configured")
    return _session_factory(database_url)()
