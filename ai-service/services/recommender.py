"""
Task Recommendation Engine
--------------------------
Scores each pending task using a weighted multi-factor formula and recommends
the one with the highest urgency score.

Scoring factors:
  1. Deadline proximity  — closer deadline = higher score (exponential)
  2. Priority weight     — high/medium/low mapped to 3/2/1
  3. Difficulty penalty  — harder tasks get bonus time to prevent cramming
  4. Estimated effort    — prefer tasks that can be completed in one sitting
  5. Status factor       — in_progress tasks get a boost to avoid context-switching

Formula:
  score = (deadline_score * 0.45)
        + (priority_score * 0.25)
        + (difficulty_bonus * 0.15)
        + (effort_score * 0.10)
        + (status_bonus * 0.05)
"""

from datetime import datetime
import math
from typing import List, Dict, Any


PRIORITY_WEIGHTS = {"high": 3, "medium": 2, "low": 1}


def _deadline_score(deadline_iso: str) -> float:
    """
    Exponential urgency based on days remaining.
    0 days → 10.0,  7 days → ~5.0,  30 days → ~1.0
    """
    deadline = datetime.fromisoformat(deadline_iso.replace("Z", "+00:00"))
    now      = datetime.now(tz=deadline.tzinfo)
    days     = (deadline - now).total_seconds() / 86400
    if days <= 0:
        return 10.0   # overdue — maximum urgency
    return 10.0 * math.exp(-0.1 * days)


def _effort_score(estimated_hours: float) -> float:
    """Tasks completable in 1–3 hours score higher (manageable chunks)."""
    if 0.5 <= estimated_hours <= 3:
        return 1.0
    elif estimated_hours <= 6:
        return 0.7
    return 0.4


def score_task(task: Dict[str, Any]) -> float:
    deadline_s  = _deadline_score(task["deadline"]) * 10   # 0–100
    priority_s  = PRIORITY_WEIGHTS.get(task["priority"], 2) / 3 * 10
    difficulty_b= (task.get("difficulty", 3) / 5) * 10    # harder → more urgent
    effort_s    = _effort_score(task.get("estimated_hours", 2)) * 10
    status_b    = 10.0 if task.get("status") == "in_progress" else 0.0

    weighted = (
        deadline_s  * 0.45 +
        priority_s  * 0.25 +
        difficulty_b* 0.15 +
        effort_s    * 0.10 +
        status_b    * 0.05
    )
    return round(min(10.0, weighted), 2)


def recommend(tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not tasks:
        return {}

    scored = [(task, score_task(task)) for task in tasks]
    scored.sort(key=lambda x: x[1], reverse=True)

    best_task, best_score = scored[0]
    alternatives = [t["id"] for t, _ in scored[1:4]]

    # Build human-readable reason
    days_left = (
        datetime.fromisoformat(best_task["deadline"].replace("Z", "+00:00")) - datetime.now()
    ).days
    reason = (
        f"{best_task['priority'].capitalize()} priority · "
        f"{max(0, days_left)} day{'s' if days_left != 1 else ''} until deadline"
    )
    if best_task.get("status") == "in_progress":
        reason = "Already in progress — best to finish before switching. " + reason

    return {
        "recommended_task_id":  best_task["id"],
        "reason":               reason,
        "urgency_score":        best_score,
        "alternative_task_ids": alternatives,
    }
