from pydantic import BaseModel, Field
from typing import List, Optional

class CodeGenerationRequest(BaseModel):
    format: str = Field(..., description="Target code format (e.g., SQL, PySpark)")
    tables: List[str] = Field(..., description="List of tables selected")
    columns: List[str] = Field(..., description="List of columns selected")
    logic: str = Field(..., description="Business logic in English")
    sample_data_size: int = Field(..., description="Number of rows to display in sample")

class DQInsights(BaseModel):
    row_count: int
    null_values: int
    duplicate_rows: int
    minimum: Optional[float] = None
    maximum: Optional[float] = None
    average: Optional[float] = None

class CodeGenerationResponse(BaseModel):
    generated_code: str
    dq_insights: DQInsights
