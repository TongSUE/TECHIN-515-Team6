#!/usr/bin/env python3
"""Fix negative unix_ms values in Firebase by recalculating from the iso field."""

import urllib.request
import urllib.parse
import json
from datetime import datetime, timezone

DB_URL    = "https://aurasync-team6-default-rtdb.firebaseio.com"
DB_SECRET = "YsI1CXg3S4UiAHPZgUqJSRo9n6Vt1PIITw8VbR1z"

def fb_get(path):
    url = f"{DB_URL}{path}.json?auth={DB_SECRET}"
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())

def fb_patch(path, data):
    url = f"{DB_URL}{path}.json?auth={DB_SECRET}"
    payload = json.dumps(data).encode()
    req = urllib.request.Request(url, data=payload, method="PATCH",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return r.status

def iso_to_unix_ms(iso):
    dt = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)

sessions = fb_get("/voc_dataset/sessions")
if not sessions:
    print("No sessions found.")
    exit()

fixed = 0
for session_id, session in sessions.items():
    readings = session.get("readings")
    if not readings:
        continue
    for reading_id, reading in readings.items():
        unix_ms = reading.get("unix_ms", 0)
        iso     = reading.get("iso", "")
        if unix_ms >= 0 or not iso:
            continue
        correct = iso_to_unix_ms(iso)
        path = f"/voc_dataset/sessions/{session_id}/readings/{reading_id}"
        fb_patch(path, {"unix_ms": correct})
        print(f"Fixed {session_id}/{reading_id}: {unix_ms} → {correct}")
        fixed += 1

print(f"\nDone. {fixed} readings fixed.")
