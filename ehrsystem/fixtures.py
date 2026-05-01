"""Seed-aligned fixtures used by validation and unit tests."""

from __future__ import annotations

PSORIASIS_TRIGGER_CHECKLIST: tuple[str, ...] = (
    "Stress",
    "Lack of Sleep",
    "Scented Products",
    "Dry Weather",
    "Skin Injury",
    "Infection",
    "Smoking",
    "Alcohol",
)


def is_valid_psoriasis_trigger(trigger_name: str) -> bool:
    """Return whether a trigger belongs to the seeded psoriasis checklist."""

    normalized_value = trigger_name.strip().casefold()
    return any(
        candidate.casefold() == normalized_value
        for candidate in PSORIASIS_TRIGGER_CHECKLIST
    )
