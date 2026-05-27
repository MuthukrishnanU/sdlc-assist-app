import os
import json
from openai import AsyncOpenAI
from .schemas import CodeGenerationRequest, CodeGenerationResponse, DQInsights
from dotenv import load_dotenv

load_dotenv()

class CodeGenerator:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    async def generate(self, request: CodeGenerationRequest) -> CodeGenerationResponse:
        try:
            # Fetch schemas from MongoDB semanticMetaStore if available
            mongodb_uri = os.getenv("MONGODB_URI")
            schema_context = ""
            if mongodb_uri:
                try:
                    from pymongo import MongoClient
                    client = MongoClient(mongodb_uri)
                    db = client["bankingSdlcDB"]
                    schema_docs = list(db['semanticMetaStore'].find({"collection_name": {"$in": request.tables}}))
                    
                    schema_context_list = []
                    for doc in schema_docs:
                        col_name = doc.get("collection_name")
                        desc = doc.get("description", "")
                        pk = doc.get("primary_key", "")
                        fields = doc.get("fields", [])
                        
                        fields_desc = []
                        for f in fields:
                            f_name = f.get("field_name")
                            f_type = f.get("data_type")
                            f_desc = f.get("description")
                            fields_desc.append(f"- {f_name} ({f_type}): {f_desc}")
                            
                        relations = doc.get("relations", [])
                        relations_desc = []
                        for r in relations:
                            relations_desc.append(f"Foreign key `{r.get('local_field')}` links to `{r.get('referenced_collection')}({r.get('referenced_field')})`")
                            
                        schema_info = f"Table: {col_name}\nDescription: {desc}\nPrimary Key: {pk}\nColumns:\n" + "\n".join(fields_desc)
                        if relations_desc:
                            schema_info += "\nRelations:\n" + "\n".join(relations_desc)
                        schema_context_list.append(schema_info)
                    
                    if schema_context_list:
                        schema_context = "\n\n=== Table Schemas ===\n" + "\n\n".join(schema_context_list)
                except Exception as e:
                    print(f"Failed to fetch schemas from semanticMetaStore: {e}")

            prompt = f"""
            You are an expert Data Engineer and AI Assistant specializing in SDLC automation.
            Generate the requested code based on the following input:
            
            Format: {request.format}
            Tables: {", ".join(request.tables)}
            Columns: {", ".join(request.columns)}
            Logic: {request.logic}
            Sample Data Size: {request.sample_data_size}
            {schema_context}
            
            === Categorical Values in the Database ===
            Here are the exact string values stored in the database for certain fields. When writing filter conditions based on natural language logic, you MUST map user terminology to these exact case-sensitive string values:
            - Table `customerDetails` -> column `kyc_status`: 'Verified', 'Pending', 'Failed'
            - Table `accountBalances` -> column `account_type`: 'Savings', 'Current'
            - Table `loanInfo` -> column `loan_type`: 'Home', 'Personal', 'Auto' (e.g. if the user query asks for "home loans", "personal loans", or "auto loans", you MUST use the exact string values 'Home', 'Personal', or 'Auto' in your filters)
            - Table `loanInfo` -> column `loan_status`: 'Active', 'Closed', 'Default' (e.g. if the user query asks for "active loans" or "active status", use 'Active')
            - Table `transactionsInfo` -> column `channel`: 'UPI', 'NetBanking', 'ATM', 'POS'
            - Table `transactionsInfo` -> column `status`: 'Success', 'Failed', 'Flagged' (e.g. if the user query asks for "successful transactions" or "success status", use 'Success')
            
            Instructions:
            1. Generate highly optimized and clean code in the requested format.
            2. ALWAYS use the exact case-sensitive table names and column names as defined in the schemas above to ensure proper query execution.
            3. The generated code MUST project, select, and output all columns specified in the 'Columns' list (i.e. {", ".join(request.columns)}) so that the simulated output contains all requested fields.
            4. Provide realistic simulated aggregate Data Quality (DQ) insights for the entire result set.
            5. Return the response as a JSON object with exactly these keys: 
               - "generated_code": (string) The full code block.
               - "dq_insights": (object) 
                 - "row_count": (integer) Total number of rows.
                 - "null_values": (integer) Total number of nulls across all columns.
                 - "duplicate_rows": (integer) Number of duplicate records.
                 - "minimum": (number/float) The lowest value in the primary numeric column.
                 - "maximum": (number/float) The highest value in the primary numeric column.
                 - "average": (number/float) The mean value of the primary numeric column.
                 - "distinct_values": (integer) Number of distinct/unique rows.
                 - "empty_strings": (integer) Number of empty string values across all columns.
            
            IMPORTANT: Every value in "dq_insights" must be a single number (int or float), NOT an object or list.
            """

            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            
            data = json.loads(response.choices[0].message.content)
            
            prompt_tokens = response.usage.prompt_tokens if response.usage else 0
            completion_tokens = response.usage.completion_tokens if response.usage else 0
            
            return CodeGenerationResponse(
                generated_code=data["generated_code"],
                dq_insights=DQInsights(**data["dq_insights"]),
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens
            )
        except Exception as e:
            print(f"Error in generation: {e}")
            # Fallback mock for demonstration
            return CodeGenerationResponse(
                generated_code=f"-- Mock code for {request.format}\nSELECT {', '.join(request.columns)} FROM {request.tables[0]} WHERE ...",
                dq_insights=DQInsights(
                     row_count=request.sample_data_size,
                     null_values=5,
                     duplicate_rows=2,
                     minimum=10.5,
                     maximum=500.0,
                     average=255.25,
                     distinct_values=max(1, request.sample_data_size - 2),
                     empty_strings=0
                ),
                prompt_tokens=0,
                completion_tokens=0
            )

generator = CodeGenerator()
