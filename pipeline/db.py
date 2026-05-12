#!/usr/bin/env python3
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv(Path(__file__).parent.parent / ".env.local")

DATABASE_URL = os.environ["DATABASE_URL"]


def get_conn():
    """psycopg2 connection — use for inserts/updates (seed, fetch, predict)."""
    return psycopg2.connect(DATABASE_URL)


def get_engine():
    """SQLAlchemy engine — use for pandas read_sql."""
    return create_engine(DATABASE_URL)
