import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.database import engine, Base
from app.api.routes import forecast, churn, anomaly, recommendations, chat, dashboard, etl, segmentation

# Create database tables if not exist (0-cost SQLite / Postgres)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-Grade AI-Powered Business Analytics Platform (SmartBizIQ)"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(forecast.router)
app.include_router(churn.router)
app.include_router(anomaly.router)
app.include_router(anomaly.root_router)
app.include_router(recommendations.router)
app.include_router(recommendations.root_router)
app.include_router(chat.router)
app.include_router(chat.root_router)
app.include_router(dashboard.router)
app.include_router(etl.router)
app.include_router(etl.root_router)
app.include_router(segmentation.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "architecture": "$0-Cost Local / Free-Tier Optimized",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy", "database": "connected"}
