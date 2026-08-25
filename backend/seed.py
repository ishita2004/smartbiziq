from app.db.database import SessionLocal, engine, Base

def seed_database():
    """Initializes empty database tables for SmartBizIQ."""
    Base.metadata.create_all(bind=engine)
    print("SmartBizIQ database tables initialized cleanly with zero pre-loaded data.")

if __name__ == "__main__":
    seed_database()

