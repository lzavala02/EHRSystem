"""Contract conformance helpers for API response envelopes.

These checks run server-side so contract drift is detected close to where
payloads are built.
"""

from __future__ import annotations

from collections.abc import Mapping


def ensure_required_keys(
    payload: Mapping[str, object],
    *,
    required_keys: set[str],
    context: str,
) -> None:
    missing_keys = sorted(key for key in required_keys if key not in payload)
    if missing_keys:
        raise ValueError(
            f"{context} payload is missing required keys: {', '.join(missing_keys)}"
        )


def ensure_list_item_required_keys(
    payload_items: list[Mapping[str, object]],
    *,
    required_keys: set[str],
    context: str,
) -> None:
    for index, item in enumerate(payload_items):
        ensure_required_keys(
            item,
            required_keys=required_keys,
            context=f"{context}[{index}]",
        )
