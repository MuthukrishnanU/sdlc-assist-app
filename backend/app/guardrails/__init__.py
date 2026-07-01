from .injection import validate_prompt_injection
from .command_block import validate_command_injection, validate_python_sandbox
from .pii_redactor import redact_pii
from .schema_protect import validate_schema_access
from .data_privacy import mask_sensitive_dataframe
from .ddl_prevention import validate_sql_readonly

async def run_input_guardrails(userId: str, role: str, logic_prompt: str, tables: list, columns: list, is_conversion: bool = False, model: str = "gpt-4o") -> str:
    """
    Applies input-level guardrails before LLM generation.
    Returns the redacted prompt.
    """
    # Guardrail 1: Prompt Injection Heuristics
    validate_prompt_injection(logic_prompt)
    
    # Guardrail 1c: Profanity Check
    from .profanity import validate_profanity
    await validate_profanity(logic_prompt)
    
    # Guardrail 1b: Authentication Bypass (Always True Escape)
    from .injection import validate_always_true_escape
    validate_always_true_escape(logic_prompt)
    
    # Guardrail 2: SQL & Command Injection Block in natural language logic
    if not is_conversion:
        validate_command_injection(logic_prompt)
    
    # Domain Relevance Guardrail: Block irrelevant queries (e.g. general math, general knowledge)
    from .relevance import validate_domain_relevance
    await validate_domain_relevance(logic_prompt, tables, columns, model)
    
    # Guardrail 4: Schema Protection (Verifies user access to table domains & columns)
    validate_schema_access(userId, tables, columns)
    
    # Guardrail 5: Custom PII Database Protection
    from ..config.settings import get_db
    import re
    from fastapi import HTTPException
    
    try:
        db = get_db()
        pii_cursor = db["piiForGuardrails"].find()
        for pii_doc in pii_cursor:
            param = pii_doc.get("piiParameter", "")
            reason = pii_doc.get("piiReason", "")
            pii_pass = pii_doc.get("piiPass", False)
            if param:
                pattern = rf"\b{re.escape(param)}\b"
                
                # Check logic prompt
                if re.search(pattern, logic_prompt, re.IGNORECASE) and not pii_pass:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Guardrail Violation: Access to sensitive PII parameter '{param}' is blocked (Reason: {reason})."
                    )
                
                # Check selected columns
                for col in columns:
                    if re.search(pattern, col, re.IGNORECASE) and not pii_pass:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Guardrail Violation: Access to sensitive PII column '{col}' is blocked (Reason: {reason})."
                        )
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"[ERROR] run_input_guardrails PII validation skipped: {e}")
        
    # Guardrail 3: PII Redaction
    redacted_prompt = redact_pii(logic_prompt)
    
    return redacted_prompt

def run_execution_guardrails(userId: str, format_str: str, code_str: str, tables: list, columns: list):
    """
    Applies sandbox execution-level guardrails before running code locally.
    """
    # Guardrail 4: Schema Protection
    validate_schema_access(userId, tables, columns)
    
    fmt = (format_str or "SQL").upper()
    is_spark = "SPARK" in fmt
    is_plsql = "PL/SQL" in fmt or "PLSQL" in fmt
    is_sql = any(x in fmt for x in ["SQL", "POSTGRE", "MY", "ORACLE", "BIGQUERY", "SNOWFLAKE", "ICEBERG"]) and "NOSQL" not in fmt and not is_spark and not is_plsql
    
    # Guardrail 6: DDL & DML Prevention (SQL AST Check)
    if is_sql:
        validate_sql_readonly(code_str)
        
    # Guardrail 2: Secure Sandbox Execution (AST Check for Python/PySpark/Firestore code execution)
    if is_spark or "FIRESTORE" in fmt or "PYTHON" in fmt:
        validate_python_sandbox(code_str)

def run_output_guardrails(dataframe: list, role: str, tables: list) -> list:
    """
    Applies output-level guardrails (Data Masking) after code execution.
    """
    # Guardrail 5: Data Privacy Masking
    return mask_sensitive_dataframe(dataframe, role, tables)
