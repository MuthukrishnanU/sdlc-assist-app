import json
from fastapi import HTTPException
from ..agents.llm import call_llm, parse_llm_json
from ..config.settings import get_db

async def validate_domain_relevance(logic_prompt: str, tables: list, columns: list, model_name: str = "gpt-4o") -> None:
    """
    Guardrail to verify if the user query is relevant to the selected tables, columns,
    or the analytical/data domain of the system.
    Blocks irrelevant queries (e.g. general arithmetic like '2+2', off-topic questions, chat, etc.).
    """
    # Fetch semantic schema details if tables are selected
    db = get_db()
    schema_details = []
    if db is not None and tables:
        try:
            schema_docs = list(db['semanticMetaStore'].find({"collection_name": {"$in": tables}}))
            for doc in schema_docs:
                col_name = doc.get("collection_name")
                desc = doc.get("description", "")
                fields = [f.get("field_name") for f in doc.get("fields", [])]
                schema_details.append(f"Table: {col_name} (Description: {desc}, Columns: {', '.join(fields)})")
        except Exception as e:
            print(f"[RELEVANCE GUARDRAIL] Failed to fetch table metadata: {e}")

    schema_context = "\n".join(schema_details) if schema_details else f"Tables: {', '.join(tables)}, Columns: {', '.join(columns)}"

    prompt = f"""
    You are a security guardrail agent. Your task is to analyze if the user's natural language query/logic is relevant to the database tables, schemas, or the general data analysis/engineering domain of the application (e.g. banking, transactions, loan accounts, customer details).
    
    User Query: "{logic_prompt}"
    
    Context:
    {schema_context}
    
    Instructions:
    1. Determine if the query is a valid data query, mapping request, analytical question, or data transformation instruction related to the domain of the selected tables/columns.
    2. Block any completely off-topic queries, such as:
       - General math / arithmetic questions that do not reference any database column or table (e.g., "What is 2 + 2?", "compute square root of 25", etc.).
       - General knowledge or trivia (e.g., "Who was the first president?").
       - General code execution or scripting requests unrelated to querying the database.
       - General conversation or chat (e.g., "Hello", "How are you?").
    3. Respond with a JSON object containing:
       - "is_relevant": (boolean) true if the query is relevant to the data/domain, false if it is off-topic/unrelated.
       - "reason": (string) a concise explanation of why the query was allowed or blocked.
    """

    try:
        content, _, _ = await call_llm(prompt, model_name or "gpt-4o", response_format_json=True)
        data = parse_llm_json(content)
        
        is_relevant = data.get("is_relevant", True)
        reason = data.get("reason", "Query is relevant to the selected domain/tables.")
        
        if not is_relevant:
            raise HTTPException(
                status_code=400,
                detail=f"Guardrail Violation: Query is off-topic and not relevant to the database tables or domain. (Reason: {reason})"
            )
    except HTTPException as he:
        raise he
    except Exception as e:
        # If LLM API call fails or times out, log it and allow by default to avoid blocking user flow
        print(f"[RELEVANCE GUARDRAIL ERROR] Guardrail check error: {e}")
        return
