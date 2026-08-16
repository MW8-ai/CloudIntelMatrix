#!/usr/bin/env python3
"""Tests for cim_query — run directly: `python scripts/test_cim_query.py`.

No third-party test framework, matching the repo's verify.py convention.
Exercises the query logic against the real data/matrix.json and the CLI's
exit-code contract (so `gov` is safe to use as a policy gate).
"""

import io
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cim_query as cim  # noqa: E402

CAPS = cim.load(cim.DEFAULT_DATA)
passed = 0


def check(cond, label):
    global passed
    if cond:
        passed += 1
        print(f"ok - {label}")
    else:
        print(f"FAIL - {label}")
        raise SystemExit(1)


def run(argv):
    """Invoke the CLI, returning (exit_code, stdout, stderr)."""
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = cim.main(argv)
    return code, out.getvalue(), err.getvalue()


# --- data sanity ---
check(len(CAPS) >= 30, f"matrix has capabilities ({len(CAPS)})")
check(all("providers" in c for c in CAPS), "every capability has providers")

# --- gov threshold logic ---
check(cim.meets("Full", "Partial") is True, "Full meets Partial threshold")
check(cim.meets("Partial", "Partial") is True, "Partial meets Partial threshold")
check(cim.meets("Limited", "Partial") is False, "Limited does not meet Partial")
check(cim.meets("Unknown", "Limited") is False, "Unknown never meets a threshold")
check(cim.meets(None, "Unknown") is False, "missing value never meets a threshold")

# --- find ---
check(len(cim.find(CAPS, "generative ai")) == 1, "case-insensitive find is exact enough")
check(len(cim.find(CAPS, "zzz-nope")) == 0, "no false-positive find")

# --- CLI exit-code contract (the gate) ---
code, _, _ = run(["gov", "--capability", "Object Storage", "--level", "Full", "--provider", "azure"])
check(code == 0, "gov gate returns 0 when a provider meets the level")

code, _, err = run(["gov", "--capability", "Object Storage", "--level", "Full", "--provider", "aws"])
check(code == 1 and "No provider" in err, "gov gate returns 1 when none meet the level")

code, _, _ = run(["gov", "--level", "Nonsense"])
check(code == 2, "invalid --level returns 2")

code, out, _ = run(["--json", "providers", "Managed Kubernetes"])
check('"providers"' in out and code == 0, "providers --json emits a providers block")

code, _, err = run(["show", "AI"])
check(code == 1 and "narrow it" in err, "ambiguous show asks to narrow")

code, out, _ = run(["list", "--category", "AI / ML"])
check(code == 0 and "Generative AI" in out, "list filters by category")

print(f"\n{passed}/{passed} passing")
