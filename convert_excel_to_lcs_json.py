"""Convert school_tracker.xlsx to lcs.json for the static GitHub Pages app.

Usage:
  python convert_excel_to_lcs_json.py

Expected input:
  school_tracker.xlsx with sheet named Schools.

Output:
  lcs.json
"""
import json
from pathlib import Path
import pandas as pd

INPUT_FILE = Path("school_tracker.xlsx")
SHEET_NAME = "Schools"
OUTPUT_FILE = Path("lcs.json")

ALIASES = {
    "Learning Centre (EN)": ["Learning Centre (EN)", "Learning Center (EN)", "LC EN", "LC Name", "Name"],
    "Latitude": ["Latitude", "Lat", "LAT", "latitude", "خط العرض", "Y"],
    "Longitude": ["Longitude", "Lon", "Long", "LON", "longitude", "خط الطول", "X"],
    "Directorate": ["Directorate", "المديرية", "Governorate"],
    "Grades": ["Grades", "الصفوف"],
    "Address": ["Address", "Geographical Location", "العنوان", "Location"],
    "Include": ["Include"],
    "Students": ["Total Students (E-Services)", "Total Students", "Students"],
    "Capacity": ["Max Capacity", "Capacity"],
}

def find_col(df, key):
    lower = {str(c).strip().lower(): c for c in df.columns}
    for candidate in ALIASES[key]:
        found = lower.get(candidate.lower())
        if found is not None:
            return found
    return None

if not INPUT_FILE.exists():
    raise FileNotFoundError(f"Missing {INPUT_FILE}. Put it next to this script.")

df = pd.read_excel(INPUT_FILE, sheet_name=SHEET_NAME)
df.columns = df.columns.astype(str).str.strip()

cols = {key: find_col(df, key) for key in ALIASES}
required = ["Learning Centre (EN)", "Latitude", "Longitude"]
missing = [key for key in required if cols[key] is None]
if missing:
    raise ValueError("Missing required columns: " + ", ".join(missing))

if cols["Include"]:
    include = df[cols["Include"]].fillna("").astype(str).str.strip().str.lower()
    df = df[include.isin(["yes", "y", "true", "1"])]

records = []
for _, row in df.iterrows():
    lat = pd.to_numeric(row.get(cols["Latitude"]), errors="coerce")
    lon = pd.to_numeric(row.get(cols["Longitude"]), errors="coerce")
    name = str(row.get(cols["Learning Centre (EN") if False else cols["Learning Centre (EN)"]) or "").strip()
    if pd.isna(lat) or pd.isna(lon) or not name:
        continue
    item = {
        "name": name,
        "lat": float(lat),
        "lon": float(lon),
        "directorate": str(row.get(cols["Directorate"]) or "").strip() if cols["Directorate"] else "",
        "grades": str(row.get(cols["Grades"]) or "").strip() if cols["Grades"] else "",
        "address": str(row.get(cols["Address"]) or "").strip() if cols["Address"] else "",
    }
    if cols["Students"]:
        students = pd.to_numeric(row.get(cols["Students"]), errors="coerce")
        if not pd.isna(students):
            item["students"] = int(students)
    if cols["Capacity"]:
        capacity = pd.to_numeric(row.get(cols["Capacity"]), errors="coerce")
        if not pd.isna(capacity):
            item["capacity"] = int(capacity)
    records.append(item)

OUTPUT_FILE.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(records)} records to {OUTPUT_FILE}")
