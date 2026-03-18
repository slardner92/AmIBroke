"""
build_hud_json.py
-----------------
Downloads the HUD FY2025 Small Area Fair Market Rents (SAFMR) Excel file
and converts it into a minified JSON lookup keyed by 5-digit ZIP code.

Output: hud_50pct.json  (despite the name, SAFMRs are 40th-percentile rents
        — the closest publicly available ZIP-level, bedroom-specific dataset)

Fields per ZIP: br0 (studio), br1 (1BR), br2 (2BR), br3 (3BR), br4 (4BR)

Run: python build_hud_json.py
Requires: pip install requests openpyxl
"""

import json
import os
import requests
import openpyxl

# HUD FY2025 SAFMR direct download URL
# Source: https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html
SAFMR_URL = "https://www.huduser.gov/portal/datasets/fmr/fmr2026/fy2026_safmrs.xlsx"
XLSX_PATH = "fy2026_safmrs.xlsx"
OUT_PATH  = "hud_50pct.json"

def download(url, dest):
    print(f"Downloading {url} ...")
    r = requests.get(url, timeout=60, stream=True)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=1 << 16):
            f.write(chunk)
    print(f"  Saved to {dest} ({os.path.getsize(dest):,} bytes)")

def parse(xlsx_path):
    print(f"Parsing {xlsx_path} ...")
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb.active

    # Identify header row and column positions
    headers = None
    col = {}
    data = {}

    for row in ws.iter_rows(values_only=True):
        if headers is None:
            # Look for the header row containing 'zip' or 'zcta'
            row_lower = [str(c).lower().strip() if c else "" for c in row]
            if any("zip" in h or "zcta" in h for h in row_lower):
                headers = row_lower
                # Map column names to indices
                for i, h in enumerate(headers):
                    if "zip" in h or "zcta" in h:
                        col["zip"] = i
                    elif h in ("efficiency", "studio", "br0", "0br", "zero_br", "0-br"):
                        col["br0"] = i
                    elif "1" in h and ("br" in h or "bed" in h):
                        col.setdefault("br1", i)
                    elif "2" in h and ("br" in h or "bed" in h):
                        col.setdefault("br2", i)
                    elif "3" in h and ("br" in h or "bed" in h):
                        col.setdefault("br3", i)
                    elif "4" in h and ("br" in h or "bed" in h):
                        col.setdefault("br4", i)
                print(f"  Header row found. Column map: {col}")
            continue

        # Data rows
        zip_val = row[col["zip"]] if "zip" in col else None
        if not zip_val:
            continue
        zip_str = str(zip_val).strip().zfill(5)[:5]
        if not zip_str.isdigit():
            continue

        def rent(key):
            if key not in col:
                return None
            v = row[col[key]]
            try:
                return int(round(float(v)))
            except (TypeError, ValueError):
                return None

        entry = {k: rent(k) for k in ("br0","br1","br2","br3","br4")}
        # Only include entries that have at least a 2BR value
        if entry.get("br2"):
            data[zip_str] = {k: v for k, v in entry.items() if v is not None}

    wb.close()
    print(f"  Parsed {len(data):,} ZIP codes.")
    return data

def main():
    if not os.path.exists(XLSX_PATH):
        download(SAFMR_URL, XLSX_PATH)
    else:
        print(f"Using cached {XLSX_PATH}")

    data = parse(XLSX_PATH)

    if not data:
        print("\nERROR: No data parsed. The column headers may have changed.")
        print("Open the Excel file and check the column names, then update the")
        print("header-detection logic in parse() above.")
        return

    with open(OUT_PATH, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Written: {OUT_PATH}  ({os.path.getsize(OUT_PATH):,} bytes, {len(data):,} ZIPs)")

if __name__ == "__main__":
    main()
