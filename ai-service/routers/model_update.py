from fastapi import APIRouter
from models.schemas import ModelUpdateRequest
from services.time_predictor import add_sample

router = APIRouter()

@router.post("/update-model")
def update_model(request: ModelUpdateRequest):
    """
    Accept real task completion data and feed it into the incremental
    learning pipeline. The regression model retrains automatically once
    enough new samples have been collected (threshold: 20 samples).
    """
    add_sample(
        category=request.category,
        difficulty=request.difficulty,
        estimated_hours=request.estimated_hours,
        actual_hours=request.actual_hours,
    )
    return {"success": True, "message": "Sample recorded. Model will retrain at threshold."}
