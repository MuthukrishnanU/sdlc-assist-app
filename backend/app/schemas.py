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
    prompt_tokens: Optional[int] = 0
    completion_tokens: Optional[int] = 0

class SimulationRequest(BaseModel):
    tables: List[str]
    columns: List[str]
    sample_data_size: int
    logic: Optional[str] = None
    generated_code: Optional[str] = None
    format: Optional[str] = None

class LineageInfo(BaseModel):
    source_tables: List[str]
    source_columns: List[str]
    transformation: str

class ColumnMetadata(BaseModel):
    friendly_name: str
    description: str
    data_type: str
    role: str
    classification: str
    lineage: Optional[LineageInfo] = None

class ExecutionExplanation(BaseModel):
    query: str
    execution_time_ms: int
    records_processed: int
    software_requirements: List[str]
    execution_steps: List[str]
    special_instructions: Optional[str] = None
    execution_cost: Optional[str] = None
    prompt_tokens: Optional[int] = 0
    completion_tokens: Optional[int] = 0

class SimulationResponse(BaseModel):
    dataframe: List[dict]
    column_details: dict # Mapping of column_name -> ColumnMetadata
    dq_insights: DQInsights
    table_dq_insights: Optional[Dict[str, DQInsights]] = None
    column_dq_insights: Optional[Dict[str, Dict[str, DQInsights]]] = None
    primary_keys: Optional[Dict[str, str]] = None
    execution_explanation: Optional[ExecutionExplanation] = None

class GitHubPushRequest(BaseModel):
    dataframe: List[dict]
    generated_code: Optional[str] = None
    format: Optional[str] = None
    repo_name: Optional[str] = None
    data_file_name: Optional[str] = None
    query_file_name: Optional[str] = None
    pod_name: Optional[str] = None
    project_name: Optional[str] = None
