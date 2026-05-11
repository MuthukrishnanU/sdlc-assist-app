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
            prompt = f"""
            You are an expert Data Engineer and AI Assistant specializing in SDLC automation.
            Generate the requested code based on the following input:
            
            Format: {request.format}
            Tables: {", ".join(request.tables)}
            Columns: {", ".join(request.columns)}
            Logic: {request.logic}
            Sample Data Size: {request.sample_data_size}
            
            Instructions:
            1. Generate highly optimized and clean code in the requested format.
            2. Provide realistic simulated aggregate Data Quality (DQ) insights for the entire result set.
            3. Return the response as a JSON object with exactly these keys: 
               - "generated_code": (string) The full code block.
               - "dq_insights": (object) 
                 - "row_count": (integer) Total number of rows.
                 - "null_values": (integer) Total number of nulls across all columns.
                 - "duplicate_rows": (integer) Number of duplicate records.
                 - "minimum": (number/float) The lowest value in the primary numeric column.
                 - "maximum": (number/float) The highest value in the primary numeric column.
                 - "average": (number/float) The mean value of the primary numeric column.
            
            IMPORTANT: Every value in "dq_insights" must be a single number (int or float), NOT an object or list.
            """

            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            
            data = json.loads(response.choices[0].message.content)
            
            return CodeGenerationResponse(
                generated_code=data["generated_code"],
                dq_insights=DQInsights(**data["dq_insights"])
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
                    average=255.25
                )
            )

generator = CodeGenerator()
