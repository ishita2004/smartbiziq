import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Boolean, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(120), nullable=True)
    segment = Column(String(50), default="Regular")
    tenure_months = Column(Integer, default=12)
    monthly_charges = Column(Float, default=70.0)
    total_charges = Column(Float, default=840.0)
    support_tickets = Column(Integer, default=1)
    churn_probability = Column(Float, default=0.15)
    risk_segment = Column(String(20), default="low")
    created_at = Column(DateTime, default=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="customer", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="customer", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), default="Subscription")
    date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="transactions")

class Metric(Base):
    __tablename__ = "metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False)
    type = Column(String(50), default="revenue") # revenue, count, average, ratio
    category = Column(String(50), default="sales")
    current_value = Column(Float, default=0.0)
    target_value = Column(Float, default=0.0)
    unit = Column(String(20), default="$")
    trend = Column(String(20), default="up")
    change_percentage = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    values = relationship("MetricValue", back_populates="metric", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="metric", cascade="all, delete-orphan")

class MetricValue(Base):
    __tablename__ = "metric_values"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    metric_id = Column(String(36), ForeignKey("metrics.id"), nullable=False)
    value = Column(Float, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    metric = relationship("Metric", back_populates="values")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=True)
    metric_id = Column(String(36), ForeignKey("metrics.id"), nullable=True)
    pred_type = Column(String(30), nullable=False) # forecast, churn, anomaly
    value = Column(Float, nullable=False)
    confidence = Column(Float, default=0.95)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    model_name = Column(String(50), default="ensemble")
    date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="predictions")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    type = Column(String(50), default="anomaly") # anomaly, churn_risk
    metric_id = Column(String(36), ForeignKey("metrics.id"), nullable=True)
    severity = Column(String(20), default="medium") # low, medium, high
    message = Column(Text, nullable=False)
    acknowledged = Column(Boolean, default=False)
    date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    metric = relationship("Metric", back_populates="alerts")

class ChatbotSession(Base):
    __tablename__ = "chatbot_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), default="anonymous")
    context = Column(Text, nullable=True) # JSON string context
    created_at = Column(DateTime, default=datetime.utcnow)
