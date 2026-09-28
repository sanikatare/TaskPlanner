"""
Shared Pydantic schemas for request/response validation across all AI service endpoints.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


# ─── Shared Task Input ─────────────────────────────────────────────────────────

class TaskInput(BaseModel):
    id: str
    title: str
    subject: str
    deadline: str                            # ISO date string
    estimated_hours: float
    priority: Literal["high", "medium", "low"] = "medium"
    difficulty: int = Field(default=3, ge=1, le=5)
    status: str = "pending"


# ─── /predict-time ────────────────────────────────────────────────────────────

class PredictTimeRequest(BaseModel):
    subject: str
    category: str
    difficulty: int = Field(ge=1, le=5)
    estimated_hours: float


class PredictTimeResponse(BaseModel):
    predicted_hours: float
    confidence: float
    factors: List[str]


# ─── /recommend ───────────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    tasks: List[TaskInput]


class RecommendResponse(BaseModel):
    recommended_task_id: str
    reason: str
    urgency_score: float
    alternative_task_ids: List[str]


# ─── /optimize-schedule ───────────────────────────────────────────────────────

class ScheduleRequest(BaseModel):
    tasks: List[TaskInput]
    study_hours_per_day: float = 6.0
    preferred_times: List[str] = ["morning", "evening"]
    start_date: str


class ScheduleBlock(BaseModel):
    task_id: str
    date: str          # YYYY-MM-DD
    start_time: str    # HH:mm
    end_time: str      # HH:mm
    duration_minutes: int


class ScheduleResponse(BaseModel):
    schedule: List[ScheduleBlock]
    total_hours: float
    feasibility_score: float
    warnings: List[str]
    optimization_notes: str


# ─── /update-model ────────────────────────────────────────────────────────────

class ModelUpdateRequest(BaseModel):
    subject: str
    category: str
    difficulty: int = Field(ge=1, le=5)
    estimated_hours: float
    actual_hours: float
    productivity_score: float = 7.0
