#!/usr/bin/env python3
import hashlib
import re
from pathlib import Path

SECURITY_PY = Path("./bifrost/security.py")
REASONER_PY = Path("./bifrost/reasoner.py")
TAURI_LIB = Path("./app/bifrost-desktop/src-tauri/src/lib.rs")


def calculate_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()


def update_tauri_hashes():
    print("[*] Auditing Bifrost codebase integrity...")
    sec_hash = calculate_sha256(SECURITY_PY)
    reas_hash = calculate_sha256(REASONER_PY)
    print(f"    -> security.py: {sec_hash}")
    print(f"    -> reasoner.py: {reas_hash}")

    if not TAURI_LIB.exists():
        print("[!] Tauri lib.rs not found. Skipping hash injection.")
        return

    content = TAURI_LIB.read_text()
    content = re.sub(
        r'const EXPECTED_SECURITY_HASH: &str = "[a-f0-9]*";',
        f'const EXPECTED_SECURITY_HASH: &str = "{sec_hash}";',
        content
    )
    content = re.sub(
        r'const EXPECTED_REASONER_HASH: &str = "[a-f0-9]*";',
        f'const EXPECTED_REASONER_HASH: &str = "{reas_hash}";',
        content
    )
    TAURI_LIB.write_text(content)
    print("[+] Hashes synchronized with Tauri root-of-trust.")


if __name__ == "__main__":
    update_tauri_hashes()
