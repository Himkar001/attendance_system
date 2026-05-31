"""
attendance.py
--------------
All CSV read/write logic for attendance records.
"""

import os
import csv
import glob
from datetime import datetime, date

ATTENDANCE_DIR = "../attendance"


def _dir():
    return os.path.join(os.path.dirname(__file__), ATTENDANCE_DIR)


def _today_csv() -> str:
    os.makedirs(_dir(), exist_ok=True)
    return os.path.join(_dir(), f"{datetime.now().strftime('%Y-%m-%d')}.csv")


def mark(name: str) -> bool:
    """Write one attendance entry. Returns True if newly written."""
    path       = _today_csv()
    file_exists = os.path.exists(path)
    with open(path, "a", newline="") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["Name", "Date", "Time", "Status"])
        now = datetime.now()
        writer.writerow([name, now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"), "Present"])
    return True


def get_today(registered_names: list) -> dict:
    """Returns present and absent lists for today."""
    path    = _today_csv()
    present = []
    if os.path.exists(path):
        with open(path, "r") as f:
            for row in csv.DictReader(f):
                present.append({"name": row["Name"], "time": row["Time"]})

    present_names = {p["name"] for p in present}
    absent        = [{"name": n} for n in registered_names if n not in present_names]

    return {
        "date":    str(date.today()),
        "present": present,
        "absent":  absent,
        "total_registered": len(registered_names),
        "present_count":    len(present),
        "absent_count":     len(absent),
        "percentage":       round(len(present) / len(registered_names) * 100, 1)
                            if registered_names else 0,
    }


def get_history(name_filter: str = None, date_filter: str = None) -> list:
    """Returns all attendance records, optionally filtered."""
    records = []
    pattern = os.path.join(_dir(), "*.csv")
    for filepath in sorted(glob.glob(pattern), reverse=True):
        with open(filepath, "r") as f:
            for row in csv.DictReader(f):
                if name_filter and row["Name"] != name_filter:
                    continue
                if date_filter and row["Date"] != date_filter:
                    continue
                records.append({
                    "name":   row["Name"],
                    "date":   row["Date"],
                    "time":   row["Time"],
                    "status": row["Status"],
                })
    return records


def get_stats(registered_names: list) -> list:
    """Per-person attendance percentage across all dates."""
    all_dates = set()
    counts    = {}

    pattern = os.path.join(_dir(), "*.csv")
    for filepath in glob.glob(pattern):
        date_str = os.path.splitext(os.path.basename(filepath))[0]
        all_dates.add(date_str)
        with open(filepath, "r") as f:
            for row in csv.DictReader(f):
                counts[row["Name"]] = counts.get(row["Name"], 0) + 1

    total_days = len(all_dates) or 1
    return [
        {
            "name":       n,
            "days_present": counts.get(n, 0),
            "total_days": total_days,
            "percentage": round(counts.get(n, 0) / total_days * 100, 1),
        }
        for n in registered_names
    ]


def get_already_marked_today() -> set:
    """Load names already marked today (for crash recovery)."""
    path = _today_csv()
    if not os.path.exists(path):
        return set()
    with open(path, "r") as f:
        return {row["Name"] for row in csv.DictReader(f)}


def export_csv(date_str: str = None) -> str:
    """Returns path to CSV file for a given date (today if None)."""
    if date_str:
        path = os.path.join(_dir(), f"{date_str}.csv")
    else:
        path = _today_csv()
    return path if os.path.exists(path) else None
