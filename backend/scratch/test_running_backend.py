import httpx
import json

def test_running():
    url = "http://localhost:8000/generate"
    payload = {
        "format": "PySpark",
        "tables": ["customerDetails", "accountBalances", "loanInfo", "transactionsInfo"],
        "columns": [
            "customer_id", "first_name", "last_name", "merchant_name",
            "loan_type", "loan_status", "credit_score", "principal_amount",
            "transaction_type", "channel"
        ],
        "logic": 'transactions as UPI inclined customers. Please add this flag into main output dataset and give the name as "loan_customer_transactions".',
        "sample_data_size": 1000,
        "model": "gpt-4o",
        "userId": "de_user_1",
        "role": "Data Engineering"
    }
    
    print("Calling running uvicorn backend in a loop of 10...")
    for i in range(1, 11):
        print(f"\n--- RUN {i} ---")
        try:
            r = httpx.post(url, json=payload, timeout=120.0)
            print(f"Status Code: {r.status_code}")
            if r.status_code == 200:
                res = r.json()
                explanation = res.get("flow_explanation", "")
                # Extract LLM details from explanation
                llm_details = [line for line in explanation.split("\n") if "Code Generation Agent" in line]
                print(f"Success! Model used: {llm_details}")
            else:
                print(f"Failed! Response: {r.text}")
        except Exception as e:
            print(f"Failed to connect / execute: {e}")

if __name__ == "__main__":
    test_running()
