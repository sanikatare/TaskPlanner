"""
Smart Study Scheduler — AI / ML Service
FastAPI application exposing:
  POST /predict-time        — regression model predicts time needed
  POST /recommend           — recommendation engine picks next best task
  POST /optimize-schedule   — scheduling algorithm builds full weekly plan
  POST /update-model        — receives actual performance data to retrain
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging

from routers import predict, recommend, schedule, model_update

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="StudyAI — AI Service",
    description="ML-powered time prediction, task recommendation and schedule optimisation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router,       tags=["Prediction"])
app.include_router(recommend.router,     tags=["Recommendation"])
app.include_router(schedule.router,      tags=["Scheduling"])
app.include_router(model_update.router,  tags=["Model Update"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
