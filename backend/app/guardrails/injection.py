import re
from fastapi import HTTPException

# Blacklist of common prompt injection indicators
PROMPT_INJECTION_KEYWORDS = [
    r"ignore\s+(?:the\s+)?(?:above|previous|system|instructions|rules|directives)",
    r"forget\s+(?:the\s+)?(?:above|previous|system|instructions|rules|directives)",
    r"bypass\s+(?:the\s+)?(?:above|previous|system|instructions|rules|directives)",
    r"override\s+(?:the\s+)?(?:above|previous|system|instructions|rules|directives)",
    r"stop\s+following\s+rules",
    r"you\s+are\s+now\s+an?\s+unrestricted",
    r"jailbreak",
    r"do\s+anything\s+now",
    r"act\s+as\s+a\s+system\s+admin",
    r"output\s+(?:the\s+)?(?:system\s+)?prompt",
    r"reveal\s+(?:the\s+)?(?:system\s+)?prompt",
    r"show\s+(?:the\s+)?(?:system\s+)?prompt",
]

def validate_prompt_injection(logic_prompt: str):
    if not logic_prompt:
        return
        
    normalized_prompt = logic_prompt.lower()
    for pattern in PROMPT_INJECTION_KEYWORDS:
        if re.search(pattern, normalized_prompt):
            raise HTTPException(
                status_code=400,
                detail="Security Violation: Possible prompt injection attempt detected."
            )

def validate_always_true_escape(logic_prompt: str):
    if not logic_prompt:
        return
        
    tautology_patterns = [
        r"\bor\b\s+(['\"]?\w+['\"]?)\s*=\s*\1\b",
        r"\bor\b\s+true\b",
        r"\bor\b\s+['\"]1['\"]\s*=\s*['\"]1['\"]",
        r"\bor\b\s+1\s*=\s*1\b"
    ]
    
    normalized_prompt = logic_prompt.lower()
    for pattern in tautology_patterns:
        if re.search(pattern, normalized_prompt):
            raise HTTPException(
                status_code=400,
                detail="Guardrail Violation: Always True Escape expression detected (Authentication Bypass pattern blocked)."
            )
