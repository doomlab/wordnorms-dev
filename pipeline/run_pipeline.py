#!/usr/bin/env python3
"""
Detached wrapper that runs fetch.py then predict.py and keeps PipelineRun
status up to date. Spawned with detached=True/unref() from the Next.js route
so it outlives the HTTP request.
"""
import sys
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from db import get_conn

HERE = Path(__file__).parent


def _set(conn, run_id, **fields):
    set_clause = ", ".join(f'"{k}" = %s' for k in fields)
    with conn.cursor() as cur:
        cur.execute(f'UPDATE "PipelineRun" SET {set_clause} WHERE id = %s',
                    (*fields.values(), run_id))
    conn.commit()


def main():
    args = sys.argv[1:]
    run_id = int(args[args.index("--run-id") + 1])
    conn = get_conn()
    try:
        _set(conn, run_id, step="fetch")
        r = subprocess.run([sys.executable, str(HERE / "fetch.py")])
        if r.returncode != 0:
            _set(conn, run_id, status="FAILED", step="fetch", finishedAt=datetime.now(timezone.utc))
            return

        _set(conn, run_id, step="predict")
        r = subprocess.run([sys.executable, str(HERE / "predict.py")])
        status = "DONE" if r.returncode == 0 else "FAILED"
        step = None if r.returncode == 0 else "predict"
        _set(conn, run_id, status=status, step=step, finishedAt=datetime.now(timezone.utc))
    except Exception:
        try:
            _set(conn, run_id, status="FAILED", finishedAt=datetime.now(timezone.utc))
        except Exception:
            pass
    finally:
        conn.close()


if __name__ == "__main__":
    main()
