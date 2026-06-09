import os
import sys
import asyncio
from pymongo import MongoClient
from dotenv import load_dotenv

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.generator import generator
from app.schemas import CodeGenerationRequest
from app.main import resolve_domains_if_needed, detect_tables_and_columns, simulate_data, SimulationRequest

load_dotenv("backend/.env")
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["bankingSdlcDB"]

async def main():
    # 1. Prepare request matching Conversational BI
    request = CodeGenerationRequest(
        format='SQL',
        tables=[],
        columns=[],
        logic='Show the customers with active home loan',
        sample_data_size=1000,
        model='llama',
        domains=['Data Engineering'],
        role='Data Scientist',
        userId='ds_user_1'
    )
    
    # Resolve domains
    resolve_domains_if_needed(request, db)
    print("Resolved tables:", request.tables)
    print("Resolved columns:", len(request.columns))
    
    # Generate code
    print("\n--- Generating Code via LLM ---")
    gen_response = await generator.generate(request)
    code = gen_response.generated_code
    print("Generated SQL Query:\n", code)
    
    # Detect tables
    detected_tables, detected_columns = detect_tables_and_columns(code, db)
    print("\nDetected Tables:", detected_tables)
    print("Detected Columns:", detected_columns)
    
    # Run simulation
    print("\n--- Running Simulation ---")
    sim_request = SimulationRequest(
        tables=detected_tables,
        columns=detected_columns,
        sample_data_size=1000,
        logic='Show the customers with active home loan',
        generated_code=code,
        format='SQL',
        model='llama'
    )
    sim_response = await simulate_data(sim_request)
    print("Simulated Pool Record Count:", len(sim_response.dataframe))
    if sim_response.dataframe:
        print("Sample Row:", sim_response.dataframe[0])

if __name__ == "__main__":
    asyncio.run(main())
