from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

DATA_PATH = Path("items_data.json")
IMAGE_DIR = Path("images")
DAMAGE_KEYS = ("Chop", "Slash", "Thrust")
DAMAGE_RANGE_RE = re.compile(r"^\s*\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?\s*$")

SUSPECT_PATTERNS = {
    r"\b(?:Gffect|Offect|Offece|Offecr|@ffece|OGffect)\b": "Effect",
    r"\b(?:Forcify|Eortify|Eorrify)\b": "Fortify",
    r"\b(?:Accribure|Accribuce|Arcribuee|Arcribuce|Attribure|Artribute|Actribute|Arctribute)\b": "Attribute",
    r"\bAgilicy\b": "Agility",
    r"\bIncelligence\b": "Intelligence",
    r"\bGndurance\b": "Endurance",
    r"\bDersonality\b": "Personality",
    r"\bDoison\b": "Poison",
    r"\bSclf\b": "Self",
    r"\bCombar\b": "Combat",
    r"\bSrealth\b|\bStecalth\b|\bStcalth\b|\bSrcalth\b": "Stealth",
    r"\bCondirion\b": "Condition",
    r"\bSrrikes\b|\bBerikes\b": "Strikes",
    r"\bprs\b|\bpes\b": "pts",
    r"\bShore Blade\b": "Short Blade",
    r"\bArhlerics\b|\bAchletics\b": "Athletics",
    r"\bMagjicka\b": "Magicka",
    r"\bDauldron\b": "Pauldron",
    r"\bGaunclet\b|\bGaunrlet\b": "Gauntlet",
}


def strings(value: object, path: str = ""):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for key, child in value.items():
            yield from strings(child, f"{path}.{key}" if path else str(key))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from strings(child, f"{path}[{index}]")


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8-sig"))
    print(f"records: {len(data)}")
    print(f"root type: {type(data).__name__}")

    names = [str(item.get("Item Name", "")).strip() for item in data]
    duplicate_names = {name: count for name, count in Counter(name.casefold() for name in names if name).items() if count > 1}
    print(f"blank names: {sum(not name for name in names)}")
    print(f"duplicate name groups: {len(duplicate_names)}")
    for folded, count in sorted(duplicate_names.items()):
        originals = sorted({name for name in names if name.casefold() == folded})
        print(f"  {count}x {originals}")

    key_counts = Counter(key for item in data for key in item)
    print("key frequencies:")
    for key, count in key_counts.most_common():
        print(f"  {count:4} {key}")

    image_files = [path for path in IMAGE_DIR.iterdir() if path.is_file()]
    image_by_stem = defaultdict(list)
    image_by_name = {path.name.casefold(): path for path in image_files}
    for path in image_files:
        image_by_stem[path.stem.casefold()].append(path.name)

    missing_images: list[str] = []
    used_names: set[str] = set()
    for item in data:
        name = str(item.get("Item Name", "")).strip()
        explicit = str(item.get("Image", "")).strip()
        if explicit:
            explicit_path = Path(explicit)
            if not explicit_path.is_absolute():
                explicit_path = DATA_PATH.parent / explicit_path
            if explicit_path.exists():
                used_names.add(explicit_path.name.casefold())
                continue
        fallback = image_by_stem.get(name.casefold())
        if fallback:
            used_names.add(fallback[0].casefold())
        elif name:
            missing_images.append(name)

    orphan_images = [path.name for path in image_files if path.name.casefold() not in used_names and path.name != "caius.png"]
    print(f"image files: {len(image_files)}")
    print(f"records missing usable image: {len(missing_images)}")
    for name in missing_images[:100]:
        print(f"  MISSING IMAGE: {name}")
    print(f"orphan images: {len(orphan_images)}")
    for name in sorted(orphan_images)[:100]:
        print(f"  ORPHAN IMAGE: {name}")

    damage_records = 0
    malformed_damage: list[tuple[int, str, str, str]] = []
    computed_damage: list[tuple[float, str]] = []
    for index, item in enumerate(data):
        stats = item.get("Stats") or {}
        values: list[float] = []
        for key in DAMAGE_KEYS:
            if key not in stats:
                continue
            text = str(stats[key]).strip()
            if not DAMAGE_RANGE_RE.fullmatch(text):
                malformed_damage.append((index, names[index], key, text))
            values.extend(float(number) for number in re.findall(r"\d+(?:\.\d+)?", text))
        if values:
            damage_records += 1
            computed_damage.append((max(values), names[index]))

    print(f"damage-bearing records: {damage_records}")
    print(f"malformed damage fields: {len(malformed_damage)}")
    for index, name, key, text in malformed_damage[:100]:
        print(f"  [{index}] {name!r} :: {key}: {text!r}")
    if computed_damage:
        lowest_damage, lowest_name = min(computed_damage)
        highest_damage, highest_name = max(computed_damage)
        print(f"max damage range: {lowest_damage:g} ({lowest_name}) to {highest_damage:g} ({highest_name})")

    suspects: list[tuple[int, str, str, str]] = []
    for index, item in enumerate(data):
        for path, text in strings(item):
            for pattern, replacement in SUSPECT_PATTERNS.items():
                if re.search(pattern, text, flags=re.IGNORECASE):
                    suspects.append((index, path, text, replacement))
                    break
            else:
                if "�" in text or re.search(r"[A-Za-z]@[A-Za-z]|\b\w*[0-9]\w*[A-Za-z]\b", text):
                    suspects.append((index, path, text, "manual review"))
    print(f"suspect strings: {len(suspects)}")
    for index, path, text, replacement in suspects[:300]:
        print(f"  [{index}] {names[index]!r} :: {path}: {text!r} -> {replacement}")

    allowed_effect_headers = {
        "Constant Effect",
        "Cast When Strikes",
        "Cast When Used",
        "Unique Effect",
    }
    unusual_headers = [
        (index, item.get("Item Name", ""), item["Effects"][0])
        for index, item in enumerate(data)
        if item.get("Effects") and item["Effects"][0] not in allowed_effect_headers
    ]
    print(f"unusual effect headers: {len(unusual_headers)}")
    for index, name, header in unusual_headers[:100]:
        print(f"  [{index}] {name!r}: {header!r}")


if __name__ == "__main__":
    main()
