import asyncio
import random
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END

from ..schemas.code_gen import CodeGenerationRequest
from .utils import get_schema_context
from .code_generators.sql_agent import generate_sql
from .code_generators.pyspark_agent import generate_pyspark
from .code_generators.plsql_agent import generate_plsql
from .code_generators.nosql_agent import generate_nosql
from .insights_agent import generate_insights
from .persona_agent import generate_personas
from ..services.simulation_runner import run_simulation_logic
from ..services.dq_profiler import calculate_dataframe_dq

# Define graph state structure
class AgentState(TypedDict):
    request: CodeGenerationRequest
    schema_context: str
    format: str
    generated_code: str
    flow_explanation: str
    dq_insights: dict
    dataframe: List[dict]
    insights: List[str]
    personas: List[dict]
    prompt_tokens: int
    completion_tokens: int
    error: Optional[str]

# Node: Resolve Schema and Metadata
async def supervisor_router_node(state: AgentState) -> dict:
    tables = state["request"].tables
    schema_ctx = get_schema_context(tables)
    return {"schema_context": schema_ctx}

# Node: SQL Generator Agent
async def sql_generator_node(state: AgentState) -> dict:
    res = await generate_sql(state["request"], state["schema_context"])
    return {
        "generated_code": res.get("generated_code", ""),
        "flow_explanation": res.get("flow_explanation", ""),
        "dq_insights": res.get("dq_insights", {}),
        "prompt_tokens": state["prompt_tokens"] + res.get("prompt_tokens", 0),
        "completion_tokens": state["completion_tokens"] + res.get("completion_tokens", 0)
    }

# Node: PySpark Generator Agent
async def pyspark_generator_node(state: AgentState) -> dict:
    res = await generate_pyspark(state["request"], state["schema_context"])
    return {
        "generated_code": res.get("generated_code", ""),
        "flow_explanation": res.get("flow_explanation", ""),
        "dq_insights": res.get("dq_insights", {}),
        "prompt_tokens": state["prompt_tokens"] + res.get("prompt_tokens", 0),
        "completion_tokens": state["completion_tokens"] + res.get("completion_tokens", 0)
    }

# Node: PL/SQL Generator Agent
async def plsql_generator_node(state: AgentState) -> dict:
    res = await generate_plsql(state["request"], state["schema_context"])
    return {
        "generated_code": res.get("generated_code", ""),
        "flow_explanation": res.get("flow_explanation", ""),
        "dq_insights": res.get("dq_insights", {}),
        "prompt_tokens": state["prompt_tokens"] + res.get("prompt_tokens", 0),
        "completion_tokens": state["completion_tokens"] + res.get("completion_tokens", 0)
    }

# Node: NoSQL Generator Agent
async def nosql_generator_node(state: AgentState) -> dict:
    res = await generate_nosql(state["request"], state["schema_context"])
    return {
        "generated_code": res.get("generated_code", ""),
        "flow_explanation": res.get("flow_explanation", ""),
        "dq_insights": res.get("dq_insights", {}),
        "prompt_tokens": state["prompt_tokens"] + res.get("prompt_tokens", 0),
        "completion_tokens": state["completion_tokens"] + res.get("completion_tokens", 0)
    }

# Node: Simulation execution for native DQ insights
async def simulation_runner_node(state: AgentState) -> dict:
    req = state["request"]
    code = state["generated_code"]
    try:
        sim_res = await run_simulation_logic(
            tables=req.tables,
            columns=req.columns,
            generated_code=code,
            format_str=req.format,
            sample_data_size=req.sample_data_size,
            logic=req.logic or "",
            role=req.role,
            userId=req.userId
        )
        final_df = sim_res["final_dataframe"]
        col_details = sim_res["column_details"]
        dq = calculate_dataframe_dq(final_df, col_details)
    except Exception as e:
        print(f"[ERROR] Simulation in supervisor failed: {e}")
        final_df = []
        dq = {
            "row_count": 0, "null_values": 0, "duplicate_rows": 0,
            "minimum": None, "maximum": None, "average": None,
            "distinct_values": 0, "empty_strings": 0
        }
    return {
        "dataframe": final_df,
        "dq_insights": dq
    }

# Node: Business & DQ Insights Analyst Agent
async def insights_generator_node(state: AgentState) -> dict:
    req = state["request"]
    is_cbi = (getattr(req, "domains", None) is not None and len(req.domains) > 0)
    if not is_cbi:
        return {"insights": []}
        
    insights = await generate_insights(
        logic=req.logic,
        columns=req.columns,
        dataframe=state.get("dataframe", []),
        dq_insights=state["dq_insights"],
        model="gpt-4o"
    )
    return {"insights": insights}

# Node: Target Persona Analyst Agent (Kept but bypassed)
async def persona_generator_node(state: AgentState) -> dict:
    return {"personas": []}

# Conditional Routing Logic
def route_format(state: AgentState) -> str:
    fmt = state["format"].upper()
    if "SPARK" in fmt:
        return "pyspark"
    elif "PL/SQL" in fmt or "PLSQL" in fmt:
        return "plsql"
    elif "NOSQL" in fmt or "MONGO" in fmt or "FIRE" in fmt:
        return "nosql"
    else:
        return "sql"

# Instantiate Graph
workflow = StateGraph(AgentState)

# Register Nodes
workflow.add_node("supervisor", supervisor_router_node)
workflow.add_node("sql", sql_generator_node)
workflow.add_node("pyspark", pyspark_generator_node)
workflow.add_node("plsql", plsql_generator_node)
workflow.add_node("nosql", nosql_generator_node)
workflow.add_node("simulation", simulation_runner_node)
workflow.add_node("insights", insights_generator_node)
workflow.add_node("persona", persona_generator_node)

# Set Entrypoint
workflow.set_entry_point("supervisor")

# Configure Conditional Edges
workflow.add_conditional_edges(
    "supervisor",
    route_format,
    {
        "sql": "sql",
        "pyspark": "pyspark",
        "plsql": "plsql",
        "nosql": "nosql"
    }
)

# Connect format generators to the simulation node
workflow.add_edge("sql", "simulation")
workflow.add_edge("pyspark", "simulation")
workflow.add_edge("plsql", "simulation")
workflow.add_edge("nosql", "simulation")

# Connect simulation node to the insights analyst agent
workflow.add_edge("simulation", "insights")

# Chain insights to END directly (bypassing persona agent as per instructions)
workflow.add_edge("insights", END)

def supervisor_decide_models(logic: str, format_str: str, tables: list) -> dict:
    """
    Supervisor routing logic to dynamically select models & deep thinking configurations.
    """
    logic_lower = (logic or "").lower()
    tables_count = len(tables) if tables else 0
    
    # Determine query complexity
    is_complex = any(k in logic_lower for k in ["join", "window", "partition", "rank", "analytic", "complex", "over", "dedup"]) or tables_count > 1
    
    if is_complex:
        #code_gen_model = random.choice(["gpt-4o", "mistral-large-latest", "meta-llama/Llama-3.3-70B-Instruct-Turbo"]) or "gpt-4o"
        code_gen_model = "gpt-4o"
        code_gen_deep_thinking = True
    else:
        #code_gen_model = random.choice(["gpt-4o", "mistral-large-latest", "meta-llama/Llama-3.3-70B-Instruct-Turbo"]) or "gemini-3.5-flash"
        code_gen_model = "gpt-4o"
        code_gen_deep_thinking = False
        
    # fallback code simulation model
    fmt = (format_str or "SQL").upper()
    if "SPARK" in fmt or "NOSQL" in fmt or "MONGO" in fmt:
        fallback_model = "meta-llama/Llama-3.3-70B-Instruct-Turbo"
        fallback_deep_thinking = False
    else:
        fallback_model = "gemini-2.5-flash"
        fallback_deep_thinking = False
        
    # Insights model (always deep thinking as per instructions)
    insights_model = "gpt-4o"
    insights_deep_thinking = True
    
    # Persona model (kept but bypassed)
    persona_model = "moonshotai/Kimi-K2.6"
    persona_deep_thinking = False
    
    return {
        "code_generation": {"model": code_gen_model, "deep_thinking": code_gen_deep_thinking},
        "fallback_simulation": {"model": fallback_model, "deep_thinking": fallback_deep_thinking},
        "insights": {"model": insights_model, "deep_thinking": insights_deep_thinking},
        "personas": {"model": persona_model, "deep_thinking": persona_deep_thinking}
    }

# Compile LangGraph
graph = workflow.compile()

async def run_agent_workflow(request: CodeGenerationRequest) -> dict:
    # Run supervisor dynamic LLM selection
    decisions = supervisor_decide_models(request.logic, request.format, request.tables)
    
    # Override request model with chosen code generation model
    request.model = decisions["code_generation"]["model"]
    
    initial_state = {
        "request": request,
        "schema_context": "",
        "format": request.format,
        "generated_code": "",
        "flow_explanation": "",
        "dq_insights": {},
        "dataframe": [],
        "insights": [],
        "personas": [],
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "llm_decisions": decisions,
        "error": None
    }
    
    final_state = await graph.ainvoke(initial_state)
    
    # Append LLM configuration details to flow explanation
    llm_info = "\n\n=== LLM Configuration Details ===\n"
    llm_info += f"- Code Generation Agent: {decisions['code_generation']['model']} (Deep Thinking: {'Enabled' if decisions['code_generation']['deep_thinking'] else 'Disabled'})\n"
    llm_info += f"- Fallback Simulation Agent: {decisions['fallback_simulation']['model']} (Deep Thinking: {'Enabled' if decisions['fallback_simulation']['deep_thinking'] else 'Disabled'})\n"
    llm_info += f"- Business Insights Agent: {decisions['insights']['model']} (Deep Thinking: {'Enabled' if decisions['insights']['deep_thinking'] else 'Disabled'})\n"
    llm_info += f"- Persona Agent: {decisions['personas']['model']} (Deep Thinking: {'Enabled' if decisions['personas']['deep_thinking'] else 'Disabled'} - Not Invoked)"
    
    final_state["flow_explanation"] = final_state.get("flow_explanation", "") + llm_info
    
    return final_state
