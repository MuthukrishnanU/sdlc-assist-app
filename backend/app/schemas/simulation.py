from pydantic import BaseModel
from typing import List, Optional, Dict, Union
from .code_gen import DQInsights

class SimulationRequest(BaseModel):
    tables: List[str]
    columns: List[str]
    sample_data_size: int
    logic: Optional[str] = None
    generated_code: Optional[str] = None
    format: Optional[str] = None
    model: Optional[str] = "gpt-4o"
    userId: Optional[str] = None
    role: Optional[str] = None
    active_tab: Optional[str] = None

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
    output_guardrails: Optional[List[dict]] = None
    insights: Optional[List[str]] = None
    personas: Optional[List[dict]] = None

class GitHubPushRequest(BaseModel):
    dataframe: List[dict]
    generated_code: Optional[str] = None
    format: Optional[str] = None
    repo_name: Optional[str] = None
    data_file_name: Optional[str] = None
    query_file_name: Optional[str] = None
    pod_name: Optional[str] = None
    project_name: Optional[str] = None
    userId: Optional[str] = None
    role: Optional[str] = None
    input_fields: Optional[dict] = None
    column_dq_insights: Optional[dict] = None
    dq_insights: Optional[Union[dict, List[dict]]] = None
    timestamp: Optional[str] = None
    test_cases: Optional[List[dict]] = None
