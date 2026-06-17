import os
import sys
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app

def main():
    client = TestClient(app)
    
    payload = {
        "format": "PySpark",
        "tables": ["customerDetails", "accountBalances", "loanInfo", "transactionsInfo"],
        "columns": [
            "customer_id", "first_name", "last_name", "merchant_name",
            "loan_type", "loan_status", "credit_score", "principal_amount",
            "transaction_type", "channel"
        ],
        "logic": (
            "10 UPI transactions as UPI inclined customers. "
            "Please add this flag into main output dataset and give the name as \"loan_customer_transactions\""
        ),
        "sample_data_size": 1000,
        "model": "kimi",
        "userId": "de_user_1",
        "role": "Data Engineer"
    }
    
    print("Calling /generate...")
    response = client.post("/generate", json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        res_data = response.json()
        print("\n--- DETECTED TABLES ---")
        print(res_data.get("detected_tables"))
        print("\n--- DETECTED COLUMNS ---")
        print(res_data.get("detected_columns"))
        print("\n--- GENERATED CODE ---")
        print(res_data.get("generated_code"))
    else:
        print(f"Error response: {response.text}")

if __name__ == "__main__":
    main()
