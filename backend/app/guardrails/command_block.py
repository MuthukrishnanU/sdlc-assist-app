import re
import ast
from fastapi import HTTPException

SQL_COMMANDS = [
    r"\bdrop\b",
    r"\binsert\b",
    r"\bupdate\b",
    r"\bdelete\b",
    r"\bdeletes\b",
    r"\btruncate\b",
    r"\balter\b",
    r"\bchange\b",
    r"--",
    r"/\*.*?\*/"
]

def validate_command_injection(logic_prompt: str):
    if not logic_prompt:
        return
    normalized = logic_prompt.lower()
    for pattern in SQL_COMMANDS:
        if re.search(pattern, normalized):
            raise HTTPException(
                status_code=400,
                detail="Security Violation: SQL commands or comments are not allowed in the logic prompt."
            )

def validate_python_sandbox(code_str: str):
    if not code_str:
        return
    try:
        tree = ast.parse(code_str)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Syntax Error: Generated code fails to parse: {e}"
        )
        
    blocked_modules = {'os', 'sys', 'subprocess', 'shutil'}
    blocked_functions = {'eval', 'exec', 'open', '__import__'}
    
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split('.')[0] in blocked_modules:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Security Violation: Import of module '{alias.name}' is blocked."
                      )
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.module.split('.')[0] in blocked_modules:
                raise HTTPException(
                    status_code=400,
                    detail=f"Security Violation: Import from module '{node.module}' is blocked."
                )
        elif isinstance(node, ast.Call):
            # Check for direct calls like exec(...) or eval(...)
            if isinstance(node.func, ast.Name):
                if node.func.id in blocked_functions:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Security Violation: Use of function '{node.func.id}' is blocked."
                    )
            # Check for calls like builtins.exec(...) or sys.exit(...)
            elif isinstance(node.func, ast.Attribute):
                if node.func.attr in blocked_functions:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Security Violation: Use of attribute/method '{node.func.attr}' is blocked."
                    )
