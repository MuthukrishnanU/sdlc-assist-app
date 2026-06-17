import re
import sqlparse
from fastapi import HTTPException

WRITE_KEYWORDS = {
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 
    'TRUNCATE', 'RENAME', 'REPLACE', 'MERGE', 'GRANT', 'REVOKE'
}

def validate_sql_readonly(sql_code: str):
    if not sql_code:
        return
        
    code_str = sql_code.strip()
    # Handle markdown code blocks
    if "```" in code_str:
        blocks = re.findall(r'```(?:\w+)?\n(.*?)\n```', code_str, re.DOTALL)
        if blocks:
            code_str = blocks[0].strip()
        else:
            code_str = re.sub(r'```(?:\w+)?', '', code_str).strip()
            
    try:
        statements = sqlparse.parse(code_str)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"SQL Parsing Failure: Fails to parse query AST: {e}"
        )
        
    for stmt in statements:
        stmt_type = stmt.get_type()
        
        # We permit SELECT and UNKNOWN (CTEs starting with WITH are parsed as UNKNOWN by sqlparse)
        if stmt_type not in ('SELECT', 'UNKNOWN'):
            raise HTTPException(
                status_code=400,
                detail=f"Security Violation: Non-select operation '{stmt_type}' detected."
            )
            
        # Verify CTE / UNKNOWN statements
        if stmt_type == 'UNKNOWN':
            first_keyword = None
            for token in stmt.tokens:
                if token.is_keyword:
                    first_keyword = token.value.upper()
                    break
            if first_keyword not in ('WITH', 'SELECT'):
                raise HTTPException(
                    status_code=400,
                    detail=f"Security Violation: SQL statement starting with unauthorized keyword '{first_keyword or 'UNKNOWN'}'. Only SELECT and WITH statements are allowed."
                )
                
        # Flatten and check all individual tokens for blocked write keywords
        for token in stmt.flatten():
            if token.is_keyword or token.ttype in sqlparse.tokens.Keyword:
                val = token.value.upper()
                if val in WRITE_KEYWORDS:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Security Violation: Database modification command '{val}' is blocked in read-only sandbox."
                    )
