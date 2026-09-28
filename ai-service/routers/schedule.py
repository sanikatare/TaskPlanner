from fastapi import APIRouter
from models.schemas import ScheduleRequest, ScheduleResponse
from services.scheduler import optimize

router = APIRouter()

@router.post("/optimize-schedule", response_model=ScheduleResponse)
def optimize_schedule(request: ScheduleRequest):
    """
    Generate an AI-optimized weekly study schedule using Earliest Deadline First
    algorithm with priority weighting and preferred time windows.
    """
    tasks_dicts = [t.model_dump() for t in request.tasks]
    result = optimize(
        tasks=tasks_dicts,
        study_hours_per_day=request.study_hours_per_day,
        preferred_times=request.preferred_times,
        start_date=request.start_date,
    )
    return ScheduleResponse(**result)
