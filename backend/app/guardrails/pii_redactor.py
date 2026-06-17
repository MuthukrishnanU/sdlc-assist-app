import re

EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
PHONE_REGEX = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
AADHAAR_REGEX = re.compile(r'\b\d{4}[ -]?\d{4}[ -]?\d{4}\b')
CREDIT_CARD_REGEX = re.compile(r'\b(?:\d[ -]*?){13,19}\b')

def luhn_check(card_number_str: str) -> bool:
    digits = [int(c) for c in card_number_str if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    odd_digits = digits[-1::-2]
    even_digits = digits[-2::-2]
    checksum = sum(odd_digits)
    for d in even_digits:
        double = d * 2
        checksum += double if double < 10 else double - 9
    return checksum % 10 == 0

def redact_pii(text: str) -> str:
    if not text:
        return text
    
    # 1. Redact Email
    text = EMAIL_REGEX.sub("[EMAIL]", text)
    
    # 2. Redact Aadhaar
    def redact_aadhaar_match(match):
        val = match.group(0)
        digits_only = re.sub(r'\D', '', val)
        if len(digits_only) == 12:
            return "[AADHAAR]"
        return val
    text = AADHAAR_REGEX.sub(redact_aadhaar_match, text)
    
    # 3. Redact Credit Cards (verified with Luhn check)
    def redact_cc_match(match):
        val = match.group(0)
        digits_only = re.sub(r'\D', '', val)
        if luhn_check(digits_only):
            return "[CREDIT_CARD]"
        return val
    text = CREDIT_CARD_REGEX.sub(redact_cc_match, text)
    
    # 4. Redact Phone
    def redact_phone_match(match):
        val = match.group(0)
        digits_only = re.sub(r'\D', '', val)
        if 7 <= len(digits_only) <= 15:
            return "[PHONE]"
        return val
    text = PHONE_REGEX.sub(redact_phone_match, text)
    
    return text
