from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from ..agents.test_cases_agent import generate_test_cases
from ..services.simulation_runner import run_simulation_logic

router = APIRouter(tags=["Testing & Test Cases"])

class GenerateTestCasesRequest(BaseModel):
    logic: str
    format: str
    tables: List[str]
    columns: List[str]
    generated_code: str
    model: Optional[str] = "gpt-4o"

class TestCaseExpectedOutput(BaseModel):
    expected_row_count: int
    description: Optional[str] = None

class TestCase(BaseModel):
    title: str
    description: str
    scenario_type: str
    mock_inputs: Dict[str, List[Dict[str, Any]]]
    expected_output: TestCaseExpectedOutput

class RunTestCaseRequest(BaseModel):
    generated_code: str
    format: str
    tables: List[str]
    columns: List[str]
    mock_inputs: Dict[str, List[Dict[str, Any]]]
    expected_output: TestCaseExpectedOutput

@router.post("/generate-test-cases", response_model=List[TestCase])
async def api_generate_test_cases(request: GenerateTestCasesRequest):
    try:
        test_cases = await generate_test_cases(
            logic=request.logic,
            format_str=request.format,
            tables=request.tables,
            columns=request.columns,
            generated_code=request.generated_code,
            model=request.model or "gpt-4o"
        )
        return test_cases
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run-test-case")
async def api_run_test_case(request: RunTestCaseRequest):
    try:
        # Run simulation with mock inputs
        sim_res = await run_simulation_logic(
            tables=request.tables,
            columns=request.columns,
            generated_code=request.generated_code,
            format_str=request.format,
            sample_data_size=100,  # limit test case run outputs to 100 rows
            logic="",
            role=None,
            userId=None,
            mock_inputs=request.mock_inputs
        )
        
        executed_successfully = sim_res.get("executed_successfully", False)
        final_dataframe = sim_res.get("final_dataframe", [])
        
        if not executed_successfully:
            return {
                "passed": False,
                "status": "Fail",
                "message": "Execution error during query simulation.",
                "actual_row_count": 0,
                "actual_output": []
            }
            
        expected_cnt = request.expected_output.expected_row_count
        actual_cnt = len(final_dataframe)
        passed = (expected_cnt == actual_cnt)
        
        return {
            "passed": passed,
            "status": "Pass" if passed else "Fail",
            "message": f"Expected {expected_cnt} rows, got {actual_cnt} rows.",
            "actual_row_count": actual_cnt,
            "actual_output": final_dataframe
        }
    except Exception as e:
        return {
            "passed": False,
            "status": "Fail",
            "message": f"Server error running test case: {str(e)}",
            "actual_row_count": 0,
            "actual_output": []
        }
