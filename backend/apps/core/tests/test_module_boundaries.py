"""Step 6.1: architectural import-boundary enforcement (AGENT.md §2.3, Module Boundaries).

Parses the AST of every Python module under ``backend/apps/`` and verifies:
1. Cross-module imports in production code only touch ``selectors``, ``services``, ``events``
   or ``constants`` (plus ``apps.core.*`` shared infrastructure).
2. The dependency graph is a strict DAG matching ``docs/03-Architecture/Module Boundaries.md``
   and ADR-020.
3. ``apps.feedback`` never imports ``apps.accounts`` or ``apps.members``.
"""

import ast
from pathlib import Path

import pytest

APPS_DIR = Path(__file__).resolve().parents[2]

ALLOWED_SURFACE = {"selectors", "services", "events", "constants"}

# Dependency direction (Module Boundaries + ADR-020): module -> allowed `apps.<target>` imports
ALLOWED_DEPENDENCIES: dict[str, set[str]] = {
    "core": set(),
    "system": {"core"},
    "audit": {"core"},
    "accounts": {"core", "system"},
    "members": {"core", "accounts", "system"},
    "evaluations": {"core", "audit", "accounts", "members", "system"},
    "feedback": {"core", "evaluations", "system"},
    "reports": {"core", "audit", "accounts", "members", "evaluations", "feedback", "system"},
    "notifications": {"core", "accounts", "evaluations", "system"},
}


def _production_files() -> list[tuple[str, Path]]:
    files: list[tuple[str, Path]] = []
    for module_dir in sorted(APPS_DIR.iterdir()):
        if not module_dir.is_dir() or module_dir.name.startswith("_"):
            continue
        for path in sorted(module_dir.rglob("*.py")):
            rel_parts = path.relative_to(module_dir).parts
            if "tests" in rel_parts or "migrations" in rel_parts:
                continue
            files.append((module_dir.name, path))
    return files


def _resolve_package(path: Path) -> list[str]:
    rel = path.relative_to(APPS_DIR.parent).with_suffix("")
    parts = list(rel.parts)
    if parts[-1] == "__init__":
        parts.pop()
    return parts


def _iter_apps_imports(path: Path) -> list[tuple[int, list[str]]]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    pkg = _resolve_package(path)
    imports: list[tuple[int, list[str]]] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                parts = alias.name.split(".")
                if parts[0] == "apps":
                    imports.append((node.lineno, parts))
        elif isinstance(node, ast.ImportFrom):
            if node.level > 0:
                base = pkg[: len(pkg) - node.level + 1]
                mod_parts = node.module.split(".") if node.module else []
                full = base + mod_parts
            else:
                if not node.module:
                    continue
                full = node.module.split(".")
            if not full or full[0] != "apps":
                continue
            if len(full) == 2:
                # `from apps.<other> import selectors, services`
                for alias in node.names:
                    imports.append((node.lineno, [*full, alias.name]))
            else:
                imports.append((node.lineno, full))
    return imports


def test_every_installed_module_is_registered_in_boundary_map():
    discovered = {
        d.name for d in APPS_DIR.iterdir() if d.is_dir() and (d / "__init__.py").exists()
    }
    assert discovered == set(ALLOWED_DEPENDENCIES), (
        f"Unmapped modules: {discovered ^ set(ALLOWED_DEPENDENCIES)}"
    )


@pytest.mark.parametrize(
    ("module_name", "path"),
    _production_files(),
    ids=lambda val: str(val.relative_to(APPS_DIR)) if isinstance(val, Path) else str(val),
)
def test_cross_module_imports_respect_public_surface_and_direction(module_name: str, path: Path):
    allowed_targets = ALLOWED_DEPENDENCIES[module_name]
    violations: list[str] = []

    for lineno, parts in _iter_apps_imports(path):
        if len(parts) < 2:
            continue
        target_module = parts[1]
        if target_module == module_name:
            continue

        if target_module not in allowed_targets:
            violations.append(
                f"{path.relative_to(APPS_DIR)}:{lineno} imports apps.{target_module} "
                f"(allowed for {module_name}: {sorted(allowed_targets)})"
            )
            continue

        if target_module == "core":
            # `core` is the shared foundation layer (permissions, exceptions, events, models, etc.)
            continue

        submodule = parts[2] if len(parts) >= 3 else "<root>"
        if submodule not in ALLOWED_SURFACE:
            violations.append(
                f"{path.relative_to(APPS_DIR)}:{lineno} imports '{'.'.join(parts)}'; "
                f"cross-module imports may only access {sorted(ALLOWED_SURFACE)}"
            )

    assert not violations, "\n".join(violations)


def test_feedback_module_never_imports_identity_modules():
    """Privacy Model §2 / Module Boundaries: `feedback` must never touch `accounts` or `members`."""
    for module_name, path in _production_files():
        if module_name != "feedback":
            continue
        for lineno, parts in _iter_apps_imports(path):
            assert len(parts) < 2 or parts[1] not in {"accounts", "members"}, (
                f"feedback privacy boundary violated at {path}:{lineno}: {'.'.join(parts)}"
            )
