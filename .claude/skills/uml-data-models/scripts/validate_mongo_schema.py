#!/usr/bin/env python3
"""
Validate a MongoDB collection-schema JSON file (the form used by this skill).

Checks the file parses, has the expected structure, and that each collection has
a `$jsonSchema` validator with a properties map; prints a short summary of each
collection (fields, required, indexes) so you can eyeball the model.

Usage:
    python validate_mongo_schema.py reviews-collections.schema.json
"""

import json
import sys


def summarize_props(props, required, indent="    "):
    lines = []
    for name, spec in props.items():
        bt = spec.get("bsonType", "?")
        req = " (required)" if name in required else ""
        extra = ""
        if "enum" in spec:
            extra = f" enum={spec['enum']}"
        if bt == "array" and isinstance(spec.get("items"), dict):
            it = spec["items"].get("bsonType", "?")
            extra = f" of {it}"
        lines.append(f"{indent}- {name}: {bt}{extra}{req}")
        # one level of nesting
        if bt == "object" and isinstance(spec.get("properties"), dict):
            lines += summarize_props(spec["properties"], spec.get("required", []), indent + "    ")
        if bt == "array" and isinstance(spec.get("items"), dict) and spec["items"].get("bsonType") == "object":
            lines += summarize_props(spec["items"].get("properties", {}),
                                     spec["items"].get("required", []), indent + "    ")
    return lines


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_mongo_schema.py <schema.json>", file=sys.stderr)
        sys.exit(2)
    path = sys.argv[1]
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    errors = []
    collections = doc.get("collections")
    if not isinstance(collections, list) or not collections:
        errors.append("Top-level 'collections' must be a non-empty array.")
        collections = []

    print(f"Database: {doc.get('database', '(unnamed)')}  ·  engine: {doc.get('engine', '?')}")
    for i, c in enumerate(collections):
        name = c.get("collection", f"<#{i}>")
        js = (c.get("validator") or {}).get("$jsonSchema")
        if not isinstance(js, dict):
            errors.append(f"[{name}] missing validator.$jsonSchema object.")
            continue
        props = js.get("properties", {})
        if not props:
            errors.append(f"[{name}] $jsonSchema has no 'properties'.")
        required = js.get("required", [])
        for r in required:
            if r not in props:
                errors.append(f"[{name}] required field '{r}' is not defined in properties.")
        print(f"\n▸ {name}  ({len(props)} fields, {len(required)} required)")
        if c.get("description"):
            print(f"    {c['description']}")
        for line in summarize_props(props, required):
            print(line)
        for idx in c.get("indexes", []):
            print(f"    index: {json.dumps(idx.get('keys', {}))}"
                  + (f"  — {idx['note']}" if idx.get("note") else ""))

    if errors:
        print("\n❌ Problems found:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    print("\n✅ Schema is well-formed.")


if __name__ == "__main__":
    main()
