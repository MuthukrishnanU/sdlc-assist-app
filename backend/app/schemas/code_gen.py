from pydantic import BaseModel, Field
from typing import List, Optional

class CodeGenerationRequest(BaseModel):
    format: str = Field(..., description="Target code format (e.g., SQL, PySpark)")
    tables: List[str] = Field(..., description="List of tables selected")
    columns: List[str] = Field(..., description="List of columns selected")
    logic: str = Field(..., description="Business logic in English")
    sample_data_size: int = Field(..., description="Number of rows to display in sample")
    model: Optional[str] = Field("gpt-4o", description="LLM model to use for generation")
    role: Optional[str] = Field(None, description="User role for tracking and quota checks")
    userId: Optional[str] = Field(None, description="User ID for tracking and quota checks")
    domains: Optional[List[str]] = Field(None, description="List of domains selected (used for CBI smart generation)")
    active_tab: Optional[str] = Field(None, description="Active UI tab (sdlc or cbi)")
    is_conversion: Optional[bool] = Field(False, description="Flag indicating legacy code conversion")

class DQInsights(BaseModel):
    row_count: int
    null_values: int
    duplicate_rows: int
    minimum: Optional[float] = None
    maximum: Optional[float] = None
    average: Optional[float] = None
    distinct_values: int
    empty_strings: int

class CodeGenerationResponse(BaseModel):
    generated_code: str
    dq_insights: DQInsights
    prompt_tokens: Optional[int] = 0
    completion_tokens: Optional[int] = 0
    flow_explanation: Optional[str] = None
    detected_tables: Optional[List[str]] = None
    detected_columns: Optional[List[str]] = None
    insights: Optional[List[str]] = None
    personas: Optional[List[dict]] = None
