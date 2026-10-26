#!/usr/bin/env python3
"""Fetch new @ruhamasfood Instagram posts and merge them into recipes.json.

Usage:
  python3 scripts/update_recipes.py --existing src/data/recipes.json --out merged.json [--new-out new.json]
      [--shortcodes CODE1,CODE2 | --shortcodes-file codes.txt]

Discovery (list of newest shortcodes) uses Instagram's anonymous web_profile_info
endpoint; it is often rate-limited/login-walled from datacenter IPs. In that case pass
shortcodes explicitly. Captions are fetched per post from Instagram's public oEmbed
endpoint, which works anonymously. Output matches the original file: indent=2, ensure_ascii=False.
"""
import argparse, json, re, sys, time, urllib.request

HANDLE = "ruhamasfood"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"


def _get(url, headers=None, tries=5):
    delay = 5
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and i < tries - 1:
                time.sleep(delay); delay *= 2; continue
            raise


def http_json(url, headers=None):
    return json.loads(_get(url, headers))


def discover_shortcodes():
    """Newest ~12 shortcodes via anonymous profile endpoint (often 401/429 from servers)."""
    d = http_json(f"https://www.instagram.com/api/v1/users/web_profile_info/?username={HANDLE}",
                  {"X-IG-App-ID": "936619743392459"})
    edges = d["data"]["user"]["edge_owner_to_timeline_media"]["edges"]
    return [e["node"]["shortcode"] for e in edges]


def fetch_post(code):
    """Return (author, caption, date_str|None). Tries /p/ then /reel/ oEmbed."""
    last = None
    for kind in ("p", "reel"):
        try:
            d = http_json(f"https://www.instagram.com/api/v1/oembed/?url=https://www.instagram.com/{kind}/{code}/")
            break
        except Exception as e:
            last = e
    else:
        raise last
    date = None
    try:  # post date from public og:description ("... - ruhamasfood on February 18, 2026: ...")
        h = _get(f"https://www.instagram.com/p/{code}/", {"User-Agent": "facebookexternalhit/1.1"})
        m = re.search(r'og:description" content="[^"]*? on ([A-Z][a-z]+ \d{1,2}, \d{4})', h)
        date = m.group(1) if m else None
    except Exception:
        pass
    return (d.get("author_name") or "").lower(), d.get("title") or "", date


STEP = re.compile(r"^\s*(\d+)[.)]\s+")
ING_HDR = re.compile(r"^\s*ingredients?\b[^:\-]*[:\-]?\s*", re.I)
METHOD_HDR = re.compile(r"^\s*(method|instructions|directions|preparation)\s*[:\-]?\s*", re.I)
SERV = re.compile(r"\b(?:serves|servings?|makes)\s*[:\-]?\s*(\d+)", re.I)
END = re.compile(r"^\s*(enjoy|ruhama|#|\.\s*$)", re.I)


# --- cleaning rules (applied inside caption_to_record) ---
PREP = re.compile(r"^(place|put|mix|combine|whisk|blend|grease|stir|add all|in a (small |large |medium )?(bowl|food processor|measuring cup|pot|pan)|using a)\b", re.I)
EQUIP = re.compile(r"^(pan|pot|dish|baking dish|baking pan|skillet|equipment|tools?)( size| used)?\s*:", re.I)
SERVES = re.compile(r"^(serves|servings?|makes|yields?)\b", re.I)
SIGNOFF = re.compile(r"\s*(enjoy\b|ruhama\b|#).*$", re.I | re.S)
TIP = re.compile(r"^\W*(small |quick |pro )?(tip|note|important)\b", re.I)


def ingredient_category(line):
    """Return why a line in the ingredients block is not an ingredient, or None to keep it."""
    if SERVES.match(line): return "serves"
    if EQUIP.match(line): return "equipment"
    if PREP.match(line): return "prep_instruction"
    return None


def clean_step(text):
    """Strip trailing sign-off ("Enjoy! Ruhama🤍", "Enjoy, Adeena and Ruhama"), hashtags, emoji.
    A mid-sentence "...and enjoy!" is kept; only the signature after it is dropped."""
    t = re.sub(r"\s#.*$", "", text, flags=re.S)
    t = re.sub(r"(^|(?<=[.!?])\s+)Enjoy\b.*$", "", t, flags=re.S)  # sentence starting with Enjoy
    t = re.sub(r"\s*\bRuhama\b[^A-Za-z0-9]*$", "", t)  # bare signature
    t = re.sub(r"[^\w.!?)\]%\"”']+$", "", t).strip()  # trailing emoji
    return t if re.search(r"[A-Za-z0-9]", t) else ""


def caption_to_record(code, caption, removed=None):
    """Turn one raw caption into a record in the site's shape. Never raises on odd captions."""
    caption = (caption or "").replace("\r", "")
    lines = [l.strip() for l in caption.split("\n")]
    name = next((l for l in lines if l), "")
    name = re.sub(r"\s+", " ", re.sub(r"[^\x20-\x7e]", "", name)).strip()  # existing names are ASCII-only
    ingredients, instructions, mode = [], [], None
    for raw in lines:
        l = raw.strip(" •-–*\t")
        if not l:
            continue
        if re.match(r"^\s*recipe\s*:?\s*$", l, re.I):
            if mode is None: mode = "ing"
            continue
        # sub-section headers ("Meatball ingredients:", "For the pan:", "Red sauce:") are dropped,
        # matching existing records
        if mode != "ins" and len(l) < 60 and l.endswith(":") and not STEP.match(l):
            if mode is None and not re.search(r"ingredient", l, re.I): continue
            mode = "ing"; continue
        m = METHOD_HDR.match(l)
        if m:
            mode = "ins"; l = l[m.end():].strip()
            if not l: continue
        elif ING_HDR.match(l) and mode != "ins":
            mode = "ing"; l = ING_HDR.sub("", l).strip()
            if not l: continue
        if mode is None:
            continue
        if mode == "ins" and (END.match(l) or TIP.match(l)):
            if TIP.match(l) and removed is not None: removed.append(("tip", l))
            break  # sign-off or appended tip ends the method
        if STEP.match(l):  # numbered step always goes to instructions
            mode = "ins"
            step = STEP.sub("", l).strip()
            cleaned = clean_step(step)
            if cleaned != step and removed is not None: removed.append(("signoff", step[len(cleaned):].strip()))
            if cleaned: instructions.append(cleaned)
            if cleaned != step: break  # step ended with a sign-off: method is over
            continue
        if mode == "ing":
            cat = ingredient_category(l)
            if cat:
                if removed is not None: removed.append((cat, l))
                continue
            ingredients.append(l)
        elif mode == "ins":
            cleaned = clean_step(l)
            if cleaned != l and removed is not None: removed.append(("signoff", l[len(cleaned):].strip()))
            if cleaned:
                if instructions: instructions[-1] += " " + cleaned
                else: instructions.append(cleaned)
            if cleaned != l: break
    sv = SERV.search(caption)
    return {
        "name": name,
        "handle": "@" + HANDLE,
        "url": f"https://www.instagram.com/p/{code}/",
        "shortcode": code,
        "macros": {},
        "servings": int(sv.group(1)) if sv else None,
        "ingredients": ingredients,
        "instructions": instructions,
        "caption_snippet": caption[:200],
        "has_ingredients": bool(ingredients),
        "has_instructions": bool(instructions),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--existing", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--new-out")
    ap.add_argument("--shortcodes")
    ap.add_argument("--shortcodes-file")
    ap.add_argument("--report", help="JSON report of skipped/collab/failed posts")
    a = ap.parse_args()
    existing = json.load(open(a.existing, encoding="utf-8"))
    have = {r.get("shortcode") for r in existing}
    if a.shortcodes: codes = a.shortcodes.split(",")
    elif a.shortcodes_file: codes = open(a.shortcodes_file).read().split()
    else:
        try: codes = discover_shortcodes()
        except Exception as e:
            sys.exit(f"Discovery blocked ({e}). Pass --shortcodes / --shortcodes-file instead.")
    new, collabs, skipped, failed = [], [], [], []
    for c in dict.fromkeys(x.strip() for x in codes):
        if not c or c in have: continue
        try: author, cap, date = fetch_post(c)
        except Exception as e:
            failed.append(c); print(f"fetch failed {c}: {e}", file=sys.stderr); continue
        rec = caption_to_record(c, cap)
        is_recipe = rec["has_ingredients"] and rec["has_instructions"]
        meta = {"shortcode": c, "author": author, "date": date, "first_line": cap.split("\n")[0][:100]}
        if not is_recipe: skipped.append(meta)
        elif author != HANDLE: collabs.append({**meta, "record": rec})
        else: new.append((date, rec))
        time.sleep(2)
    report = {"skipped_non_recipes": skipped, "collab_recipes": collabs, "fetch_failed": failed,
              "new_dates": {r["shortcode"]: d for d, r in new}}
    # pinned posts sit at the top of the grid out of order: sort by date (stable for ties/unknown)
    from datetime import datetime
    key = lambda t: datetime.strptime(t[0], "%B %d, %Y") if t[0] else datetime.min
    new = [r for _, r in sorted(new, key=key, reverse=True)]
    if a.report: json.dump(report, open(a.report, "w"), indent=2, ensure_ascii=False)
    dump = lambda obj, p: open(p, "w", encoding="utf-8").write(json.dumps(obj, indent=2, ensure_ascii=False))
    if a.new_out: dump(new, a.new_out)
    dump(new + existing, a.out)
    print(f"{len(new)} new recipes, {len(collabs)} collab recipes held, {len(skipped)} skipped, {len(failed)} failed", file=sys.stderr)


if __name__ == "__main__":
    main()
