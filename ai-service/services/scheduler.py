"""
Schedule Optimiser
------------------
Implements a Greedy Earliest-Deadline-First (EDF) algorithm enhanced with:
  - Priority weight sorting within same-deadline groups
  - Session chunking (max 2 h per block to avoid fatigue)
  - Preferred time window mapping
  - Feasibility check with warnings
  - Smart rescheduling for skipped tasks

Algorithm steps:
  1. Sort tasks by deadline ASC, then priority DESC
  2. For each day starting from start_date:
       a. Determine available slots based on study_hours_per_day & preferred_times
       b. Fill slots with pending task chunks (greedy fill)
       c. If a task is too large for remaining capacity today, carry to next day
  3. After all days, emit warnings for tasks that cannot be scheduled
     before their deadlines
"""

from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Tuple
import math
import logging

logger = logging.getLogger(__name__)

# Time windows for preferred study times (24h format)
TIME_WINDOWS = {
    "morning":   ("06:00", "10:00"),
    "afternoon": ("13:00", "17:00"),
    "evening":   ("18:00", "21:00"),
    "night":     ("21:00", "23:30"),
}

DEFAULT_WINDOW = ("08:00", "22:00")
MAX_BLOCK_HOURS = 2.0      # maximum single study block
MIN_BLOCK_HOURS = 0.5      # minimum useful block (30 min)
PRIORITY_WEIGHT = {"high": 3, "medium": 2, "low": 1}


def _parse_time(hhmm: str) -> Tuple[int, int]:
    h, m = map(int, hhmm.split(":"))
    return h, m


def _add_minutes(hhmm: str, minutes: int) -> str:
    h, m = _parse_time(hhmm)
    total = h * 60 + m + minutes
    return f"{total // 60:02d}:{total % 60:02d}"


def _minutes_between(start: str, end: str) -> int:
    sh, sm = _parse_time(start)
    eh, em = _parse_time(end)
    return (eh * 60 + em) - (sh * 60 + sm)


def _build_day_slots(preferred_times: List[str], study_hours_per_day: float) -> List[Tuple[str, str]]:
    """
    Returns ordered list of (start, end) time strings for study blocks today.
    Distributes available hours across preferred windows.
    """
    windows = [TIME_WINDOWS.get(p, DEFAULT_WINDOW) for p in preferred_times] or [DEFAULT_WINDOW]
    # Remove duplicates while preserving order
    seen, unique = set(), []
    for w in windows:
        if w not in seen:
            seen.add(w)
            unique.append(w)

    total_minutes = int(study_hours_per_day * 60)
    slots = []

    for (ws, we) in unique:
        available = _minutes_between(ws, we)
        chunk     = min(available, total_minutes)
        if chunk >= int(MIN_BLOCK_HOURS * 60):
            slots.append((ws, _add_minutes(ws, chunk)))
            total_minutes -= chunk
        if total_minutes <= 0:
            break

    return slots


def optimize(
    tasks: List[Dict[str, Any]],
    study_hours_per_day: float,
    preferred_times: List[str],
    start_date: str,
) -> Dict[str, Any]:
    """
    Main entry point. Returns a ScheduleResponse-compatible dict.
    """
    if not tasks:
        return {
            "schedule": [],
            "total_hours": 0,
            "feasibility_score": 1.0,
            "warnings": [],
            "optimization_notes": "No tasks to schedule.",
        }

    # Sort: earliest deadline first, then higher priority first
    def sort_key(t: Dict) -> Tuple:
        deadline = datetime.fromisoformat(t["deadline"].replace("Z", "+00:00"))
        prio     = -PRIORITY_WEIGHT.get(t["priority"], 2)
        return (deadline, prio)

    sorted_tasks = sorted(tasks, key=sort_key)

    # Remaining hours per task (mutable copy)
    remaining: Dict[str, float] = {
        t["id"]: t["estimated_hours"] for t in sorted_tasks
    }

    schedule: List[Dict[str, Any]] = []
    warnings: List[str]            = []
    current_date = date.fromisoformat(start_date)
    max_days     = 60   # look ahead at most 60 days

    for day_offset in range(max_days):
        day = current_date + timedelta(days=day_offset)
        day_str = day.isoformat()

        # Build available time slots for the day
        slots = _build_day_slots(preferred_times, study_hours_per_day)
        day_minutes_left = sum(_minutes_between(s, e) for s, e in slots)

        slot_idx = 0
        current_slot_start = slots[slot_idx][0] if slots else None

        for task in sorted_tasks:
            tid = task["id"]
            if remaining[tid] <= 0:
                continue   # already fully scheduled

            # Don't schedule past the task's deadline
            deadline = datetime.fromisoformat(task["deadline"].replace("Z", "+00:00")).date()
            if day > deadline:
                continue

            while remaining[tid] > 0 and slot_idx < len(slots) and day_minutes_left > 0:
                slot_end = slots[slot_idx][1]
                avail_minutes = _minutes_between(current_slot_start, slot_end)

                block_hours   = min(remaining[tid], MAX_BLOCK_HOURS)
                block_minutes = int(block_hours * 60)
                block_minutes = min(block_minutes, avail_minutes)

                if block_minutes < int(MIN_BLOCK_HOURS * 60):
                    # Slot too small — move to next slot
                    slot_idx += 1
                    if slot_idx < len(slots):
                        current_slot_start = slots[slot_idx][0]
                    break

                block_end = _add_minutes(current_slot_start, block_minutes)

                schedule.append({
                    "task_id":          tid,
                    "date":             day_str,
                    "start_time":       current_slot_start,
                    "end_time":         block_end,
                    "duration_minutes": block_minutes,
                })

                remaining[tid]    -= block_minutes / 60
                day_minutes_left  -= block_minutes
                current_slot_start = block_end   # continue from where we left off

                # If we've finished this slot, move to the next
                if current_slot_start >= slot_end:
                    slot_idx += 1
                    if slot_idx < len(slots):
                        current_slot_start = slots[slot_idx][0]
                    break

    # Emit warnings for tasks that still have unscheduled hours
    for task in sorted_tasks:
        tid = task["id"]
        if remaining[tid] > 0.25:
            deadline = datetime.fromisoformat(task["deadline"].replace("Z", "+00:00")).date()
            warnings.append(
                f'"{task["title"]}" has {remaining[tid]:.1f}h unscheduled — deadline {deadline}'
            )

    # Calculate metrics
    total_hours = sum(b["duration_minutes"] for b in schedule) / 60
    tasks_fully_scheduled = sum(1 for t in sorted_tasks if remaining[t["id"]] <= 0.25)
    feasibility_score = round(tasks_fully_scheduled / len(sorted_tasks), 2) if sorted_tasks else 1.0

    notes = (
        f"Scheduled {len(schedule)} blocks over "
        f"{len(set(b['date'] for b in schedule))} days. "
        f"{tasks_fully_scheduled}/{len(sorted_tasks)} tasks fully covered."
    )

    return {
        "schedule":           schedule,
        "total_hours":        round(total_hours, 2),
        "feasibility_score":  feasibility_score,
        "warnings":           warnings,
        "optimization_notes": notes,
    }
