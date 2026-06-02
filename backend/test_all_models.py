import httpx
import json

def test_all():
    url_generate = "http://localhost:8000/generate"
    
    tables = ["customerDetails", "loanInfo", "transactionsInfo"]
    columns = [
        "customer_id", "customer_name", "loan_type", "loan_status", 
        "credit_score", "principal_amount", "credit_score_bucket", 
        "principal_bucket", "loan_customer_transactions", 
        "merchant_name", "channel", "transaction_type", "transaction_amount"
    ]
    logic = (
        "Prepare a table with customer name where loan type is Home Loan and status is Active. "
        "Also create a flag on credit score where credit score is less than 650 - Risky, 651-750 - Average, 750-850 - Good, >850 - Excellent. "
        "Also, if principal amount is less than 1000000 - low bucket, if principal amount is between 1000000 - 5000000 - medium bucket, if principal amount is greater than 5000000 - high bucket. "
        "Prepare a table also to highlight the customer which are doing more than 10 UPI transactions as UPI inclined customers. "
        "Please add this flag into main output dataset and give the name as 'loan_customer_transactions'."
    )
    
    formats = ["SQL", "SparkSQL", "PL/SQL"]
    models = ["llama", "gemini-3.5-flash", "mistral", "qwen"]
    
    for model in models:
        for fmt in formats:
            print(f"\n==========================================")
            print(f"Model: {model} | Format: {fmt}")
            print(f"==========================================")
            
            gen_payload = {
                "format": fmt,
                "tables": tables,
                "columns": columns,
                "logic": logic,
                "sample_data_size": 2000,
                "model": model,
                "role": "Data Engineering",
                "userId": "test-user"
            }
            
            try:
                r_gen = httpx.post(url_generate, json=gen_payload, timeout=30.0)
                if r_gen.status_code != 200:
                    print(f"Generate failed: {r_gen.status_code} - {r_gen.text}")
                    continue
                    
                gen_data = r_gen.json()
                code_str = gen_data["generated_code"]
                print("GENERATED CODE:")
                print(code_str)
                
            except Exception as e:
                print(f"Error testing: {e}")

if __name__ == "__main__":
    test_all()
