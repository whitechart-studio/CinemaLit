"""Convert an indented plain-text screenplay (script.txt) to .fountain.

    python scripts/txt_to_fountain.py in.txt out.fountain --title "BATMAN" --author "Sam Hamm"

Dedents every line (fountain is column-0), keeps blank-line structure, and
prepends a title page the studio's parser reads.
"""
import argparse
import re
import sys

SLUG = re.compile(r"^(INT|EXT|INT\.?/EXT|I/E|EST)[\s./]", re.I)


def convert(text: str, title: str, author: str, date: str) -> str:
    out = [f"Title: {title}", "Credit: Written by", f"Author: {author}"]
    if date:
        out.append(f"Date: {date}")
    out += ["", ""]

    blank = False
    for raw in text.splitlines():
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            if not blank:
                out.append("")
            blank = True
            continue
        blank = False
        # Transitions get the fountain forced-transition marker so they are
        # never mistaken for a character cue.
        if stripped.endswith(("CUT TO:", "DISSOLVE TO:", "FADE OUT.", "FADE TO:")) and stripped.isupper():
            out.append("> " + stripped)
        else:
            out.append(stripped)
    return "\n".join(out).strip() + "\n"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--title", default="Untitled Screenplay")
    p.add_argument("--author", default="Anonymous")
    p.add_argument("--date", default="")
    a = p.parse_args()

    text = open(a.src, encoding="utf-8", errors="replace").read()
    result = convert(text, a.title, a.author, a.date)
    open(a.dst, "w", encoding="utf-8", newline="\n").write(result)
    print(f"{a.dst}: {len(result.splitlines())} lines, "
          f"{sum(1 for l in result.splitlines() if SLUG.match(l))} scenes")


def demo() -> None:
    src = "     EXT. ROOF - NIGHT\n\n     Wind.\n\n                    NICK\n               Hi.\n\n            CUT TO:\n"
    got = convert(src, "T", "A", "")
    assert "EXT. ROOF - NIGHT" in got.splitlines()
    assert "NICK" in got.splitlines()
    assert "Hi." in got.splitlines()
    assert "> CUT TO:" in got.splitlines()
    assert got.splitlines().count("") <= 6  # no runs of blank lines
    print("ok")


if __name__ == "__main__":
    if "--demo" in sys.argv:
        demo()
    else:
        main()
