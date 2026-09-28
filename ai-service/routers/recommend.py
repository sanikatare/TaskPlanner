from fastapi import APIRouter
from models.schemas import RecommendRequest, RecommendResponse
from services.recommender import recommend

router = APIRouter()

@router.post("/recommend", response_model=RecommendResponse)
def recommend_task(request: RecommendRequest):
    """
    Given a list of pending tasks, return the single most urgent task
    to work on next along with alternatives.
    """
    tasks_dicts = [t.model_dump() for t in request.tasks]
    result = recommend(tasks_dicts)

    if not result:
        # Return first task as fallback if no tasks scored
        first = request.tasks[0]
        return RecommendResponse(
            recommended_task_id=first.id,
            reason="Only one task available",
            urgency_score=5.0,
            alternative_task_ids=[],
        )

    return RecommendResponse(**result)
