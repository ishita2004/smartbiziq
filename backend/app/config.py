import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "SmartBizIQ Analytics Platform"
    VERSION: str = "2.0.0"
    API_PREFIX: str = ""
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./smartbiziq.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    ALLOWED_ORIGINS: list = os.getenv(
        "ALLOWED_ORIGINS", 
        "http://localhost:3000,https://smart-biz-iq-frontend1-yvmm.vercel.app,http://127.0.0.1:3000"
    ).split(",")

settings = Settings()
