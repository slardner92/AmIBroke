"""
build_zip_coords.py
-------------------
Downloads the Census ZCTA Gazetteer file and outputs a compact JSON of
ZIP → [lat, lng] centroids. Used by the client to find nearby ZIP codes
with falling rents (via haversine distance against zori_trends.json).

Output: zip_coords.json  (~600KB, ~33K ZCTAs at 4dp precision)

Run:   python build_zip_coords.py
Requires: pip install requests
"""

import io
import json
import os
import requests
import zipfile

GAZZETTEER_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/"
    "2024_Gaz_zcta_national.zip"
)
ZIP_PATH = "2024_Gaz_zcta_national.zip"
OUT_PATH = "zip_coords.json"


def download(url, dest):
    print(f"Downloading {url} ...")
    r = requests.get(url, timeout=120, stream=True)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=1 << 16):
            f.write(chunk)
    print(f"  Saved {dest} ({os.path.getsize(dest):,} bytes)")


def parse(zip_path):
    print(f"Parsing {zip_path} ...")
    data = {}
    with zipfile.ZipFile(zip_path) as zf:
        # Find the .txt file inside
        txt_name = next(n for n in zf.namelist() if n.endswith(".txt"))
        with zf.open(txt_name) as f:
            lines = io.TextIOWrapper(f, encoding="utf-8")
            header = None
            for line in lines:
                parts = line.rstrip("\n").split("\t")
                if header is None:
                    header = [h.strip().upper() for h in parts]
                    print(f"  Columns: {header}")
                    continue
                row = dict(zip(header, parts))
                try:
                    zcta = str(row.get("GEOID", "")).strip().zfill(5)[:5]
                    lat  = round(float(row["INTPTLAT"]), 4)
                    lng  = round(float(row["INTPTLONG"]), 4)
                    if zcta.isdigit():
                        data[zcta] = [lat, lng]
                except (KeyError, ValueError):
                    continue
    print(f"  Parsed {len(data):,} ZCTAs.")
    return data


def main():
    if not os.path.exists(ZIP_PATH):
        download(GAZZETTEER_URL, ZIP_PATH)
    else:
        print(f"Using cached {ZIP_PATH}")

    data = parse(ZIP_PATH)

    if not data:
        print("ERROR: No data parsed.")
        return

    with open(OUT_PATH, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Written: {OUT_PATH}  ({os.path.getsize(OUT_PATH):,} bytes, {len(data):,} ZCTAs)")


if __name__ == "__main__":
    main()
