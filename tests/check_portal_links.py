from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]

PAGES = {
    "index.html": ("overview", "综合总览"),
    "top01/index.html": ("sampling", "第一轮核心问题"),
    "top01-round2/index.html": ("sampling", "第二轮复测"),
    "top01-two-week-compare/index.html": ("sampling", "两周趋势对比"),
    "top2-top3/index.html": ("sampling", "扩展问题"),
    "total/index.html": ("sampling", "全部问题总览"),
    "douyin-citation-report/index.html": ("citation", "引用源分析"),
    "douyin-citation-report-round2/index.html": ("citation", "第二轮引用源"),
    "chanquanquan-citation-report/index.html": ("citation", "蝉圈圈引用源"),
    "chanjing-ai/index.html": ("product", "蝉镜 AI"),
    "chanquanquan-geo/index.html": ("product", "蝉圈圈 GEO"),
    "chanmama-creative-geo/index.html": ("more", "蝉妈妈创意 GEO"),
    "account-matrix/index.html": ("operations", "账号矩阵日报"),
    "daily-hotspot/index.html": ("operations", "热点与行业活动"),
}


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[tuple[str, str]] = []
        self.scripts: list[dict[str, str | None]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.references.append(("href", values["href"] or ""))
        elif tag in {"img", "script"} and values.get("src"):
            self.references.append(("src", values["src"] or ""))
        elif tag == "link" and values.get("href"):
            self.references.append(("href", values["href"] or ""))
        if tag == "script":
            self.scripts.append(values)


def local_target(page: Path, reference: str) -> Path | None:
    parts = urlsplit(reference)
    if parts.scheme or parts.netloc or reference.startswith(("#", "data:", "mailto:", "javascript:")):
        return None
    path = unquote(parts.path)
    if not path:
        return None
    target = (page.parent / path).resolve()
    if path.endswith("/"):
        target /= "index.html"
    return target


def check() -> list[str]:
    errors: list[str] = []
    workspace = ROOT.resolve()

    for relative, (section, label) in PAGES.items():
        page = ROOT / relative
        if not page.is_file():
            errors.append(f"missing route: {relative}")
            continue

        parser = ReferenceParser()
        source = page.read_text(encoding="utf-8-sig")
        parser.feed(source)

        shell_scripts = [
            item for item in parser.scripts
            if (item.get("src") or "").split("?", 1)[0].endswith("assets/platform-shell.js")
        ]
        if len(shell_scripts) != 1:
            errors.append(f"{relative}: expected one platform shell script")
        else:
            shell = shell_scripts[0]
            if shell.get("data-section") != section:
                errors.append(f"{relative}: wrong data-section")
            if shell.get("data-label") != label:
                errors.append(f"{relative}: wrong data-label")

        if "assets/platform-shell.css" not in source:
            errors.append(f"{relative}: missing platform shell stylesheet")

        for attribute, reference in parser.references:
            target = local_target(page, reference)
            if target is None:
                continue
            try:
                target.relative_to(workspace)
            except ValueError:
                errors.append(f"{relative}: {attribute} escapes workspace: {reference}")
                continue
            if not target.exists():
                errors.append(f"{relative}: missing {attribute} target: {reference}")

    homepage = (ROOT / "index.html").read_text(encoding="utf-8-sig")
    if "dashboard-data.js" in homepage or "source_urls_data.js" in homepage:
        errors.append("index.html: homepage loads a full module data file")
    if "实时监控飞瓜" not in homepage or "每日实时监控飞瓜的数据、改动、优势等全方面" not in homepage:
        errors.append("index.html: planned Feigua monitoring copy is missing")
    if "统一查看 GEO、引用源、产品研究与运营数据的最新状态" not in homepage:
        errors.append("index.html: first-viewport research directions are inconsistent")
    if "蝉妈妈与飞瓜分析" in homepage:
        errors.append("index.html: superseded competitor-stage label remains")
    shell = (ROOT / "assets/platform-shell.js").read_text(encoding="utf-8")
    for route in (
        "./chanquanquan-citation-report/",
        "./chanquanquan-geo/",
        "./chanmama-creative-geo/",
        "./chanmama-creative-geo/#citation-section",
        "./account-matrix/",
        "./daily-hotspot/",
    ):
        if route not in shell:
            errors.append(f"platform shell: missing route {route}")

    for stylesheet in ("assets/platform-shell.css", "assets/portal.css"):
        css = (ROOT / stylesheet).read_text(encoding="utf-8")
        if "@media (prefers-reduced-motion: reduce)" not in css:
            errors.append(f"{stylesheet}: missing reduced-motion behavior")

    return errors


def main() -> int:
    errors = check()
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"OK: {len(PAGES)} routes and their local references are valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
