from fastapi import APIRouter
from models.schemas import PredictTimeRequest, PredictTimeResponse
from services.time_predictor import predict

router = APIRouter()

@router.post("/predict-time", response_model=PredictTimeResponse)
def predict_time(request: PredictTimeRequest):
    """
    Predict actual time required for a task using the regression model.
    Returns predicted hours, confidence score, and explanation factors.
    """
    result = predict(
        category=request.category,
        difficulty=request.difficulty,
        estimated_hours=request.estimated_hours,
    )
    return PredictTimeResponse(**result)
