from pydantic import BaseModel, Field
from typing import List, Optional, Dict

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

class SimulationRequest(BaseModel):
    tables: List[str]
    columns: List[str]
    sample_data_size: int
    logic: Optional[str] = None

class ColumnMetadata(BaseModel):
    friendly_name: str
    description: str
    data_type: str
    role: str
    classification: str

class SimulationResponse(BaseModel):
    dataframe: List[dict]
    column_details: dict # Mapping of column_name -> ColumnMetadata
    dq_insights: DQInsights
    table_dq_insights: Optional[Dict[str, DQInsights]] = None
    column_dq_insights: Optional[Dict[str, Dict[str, DQInsights]]] = None
    primary_keys: Optional[Dict[str, str]] = None

class GitHubPushRequest(BaseModel):
    dataframe: List[dict]
    generated_code: Optional[str] = None
    format: Optional[str] = None
    repo_name: Optional[str] = None
    file_name: Optional[str] = None
