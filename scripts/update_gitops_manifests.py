from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: update_gitops_manifests.py IMAGE_TAG")

tag = sys.argv[1]
if not tag.isdigit():
    raise SystemExit("Invalid image tag")

for filename, image in [
    ("k8s/api.yaml", "rohitkotla/shopnova-api"),
    ("k8s/web.yaml", "rohitkotla/shopnova-web"),
]:
    path = Path(filename)
    content = path.read_text()
    pattern = r"(^\s*image:\s*)" + re.escape(image) + r":[^\s]+"

    updated, count = re.subn(
        pattern,
        lambda match: match.group(1) + image + ":" + tag,
        content,
        flags=re.MULTILINE,
    )

    if count != 1:
        raise SystemExit(
            f"Expected one image entry in {filename}; found {count}"
        )

    path.write_text(updated)
    print(f"Validated image entry in {filename}")
