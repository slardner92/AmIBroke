"""
build_zori_json.py
------------------
Downloads the Zillow Observed Rent Index (ZORI) CSV at ZIP-code level
and converts it into a compact JSON lookup keyed by 5-digit ZIP code.

Output: zori_trends.json
Fields per ZIP:
  rent  - latest monthly ZORI value (smoothed typical observed rent, all unit types)
  yoy   - year-over-year % change (positive = rising, negative = falling), rounded to 1 decimal

Run:   python build_zori_json.py
Requires: pip install requests
"""

import csv
import io
import json
import os
import requests

# Zillow Research public CSV — ZORI, all homes, smoothed, seasonally adjusted, ZIP level
ZORI_URL = (
    "https://files.zillowstatic.com/research/public_csvs/"
    "zori/Zip_zori_uc_sfrcondomfr_sm_month.csv"
)
CSV_PATH = "zori_zip.csv"
OUT_PATH = "zori_trends.json"


def download(url, dest):
    print(f"Downloading {url} ...")
    r = requests.get(url, timeout=120, stream=True)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=1 << 16):
            f.write(chunk)
    print(f"  Saved to {dest} ({os.path.getsize(dest):,} bytes)")


def parse(csv_path):
    print(f"Parsing {csv_path} ...")
    data = {}

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames

        # Date columns are the ones that look like YYYY-MM-DD
        date_cols = sorted([c for c in fields if len(c) == 10 and c[4] == "-"])
        if not date_cols:
            print("ERROR: No date columns found.")
            return data

        latest_col = date_cols[-1]
        print(f"  Latest month: {latest_col}")

        # Find the column from ~12 months ago for YoY calc
        yoy_col = None
        for col in reversed(date_cols):
            if col < latest_col[:4]:  # rough check — at least ~12 months earlier
                # More precise: find col closest to 12 months before latest
                break
        # Precise approach: parse the latest date and go back 12 months
        latest_year = int(latest_col[:4])
        latest_month = int(latest_col[5:7])
        target_year = latest_year - 1
        target_str = f"{target_year}-{latest_month:02d}"
        # Find closest match
        candidates = [c for c in date_cols if c.startswith(target_str)]
        if candidates:
            yoy_col = candidates[0]
        else:
            # Fall back: find closest date column to 12 months ago
            target_full = f"{target_year}-{latest_month:02d}-01"
            closest = min(date_cols, key=lambda c: abs(
                (int(c[:4]) * 12 + int(c[5:7])) -
                (target_year * 12 + latest_month)
            ))
            # Only use if within 2 months of target
            diff = abs((int(closest[:4]) * 12 + int(closest[5:7])) -
                       (target_year * 12 + latest_month))
            if diff <= 2:
                yoy_col = closest

        print(f"  YoY reference: {yoy_col}")

        for row in reader:
            zip_code = str(row.get("RegionName", "")).strip().zfill(5)[:5]
            if not zip_code.isdigit() or len(zip_code) != 5:
                continue

            # Latest rent
            try:
                rent = float(row[latest_col])
            except (KeyError, TypeError, ValueError):
                continue

            rent = round(rent)

            entry = {"rent": rent}

            # YoY change
            if yoy_col:
                try:
                    prev = float(row[yoy_col])
                    if prev > 0:
                        yoy = round((rent - prev) / prev * 100, 1)
                        entry["yoy"] = yoy
                except (KeyError, TypeError, ValueError):
                    pass

            data[zip_code] = entry

    print(f"  Parsed {len(data):,} ZIP codes.")
    return data


def main():
    if not os.path.exists(CSV_PATH):
        download(ZORI_URL, CSV_PATH)
    else:
        print(f"Using cached {CSV_PATH}")

    data = parse(CSV_PATH)

    if not data:
        print("\nERROR: No data parsed.")
        return

    with open(OUT_PATH, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size = os.path.getsize(OUT_PATH)
    print(f"Written: {OUT_PATH}  ({size:,} bytes, {len(data):,} ZIPs)")


if __name__ == "__main__":
    main()
