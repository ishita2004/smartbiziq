from enum import Enum

class ModelType(str, Enum):
    PROPHET = "prophet"
    ARIMA = "arima"
    LSTM = "lstm"
    GRU = "gru"
    ENSEMBLE = "ensemble"

class SeverityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class ChurnRiskSegment(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class MetricCategory(str, Enum):
    REVENUE = "revenue"
    CUSTOMER = "customer"
    SALES = "sales"
    OPERATIONS = "operations"
    MARKETING = "marketing"
