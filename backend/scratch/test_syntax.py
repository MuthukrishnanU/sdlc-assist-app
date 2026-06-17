import ast

code = """loan_customer_transactions = customer_loan_upi_df.join(
    latest_transactions_df,
    on="customer_id",
    how="left"
)

# step 8: Project all required columns and deduplicate
loan_customer_transactions = loan_customer_transactions.select(
    col("customer_id"),
    col("first_name"),
    col("last_name"),
    col("merchant_name"),
    col("loan_type"),
    col("loan_status"),
    col("credit_score"),
    col("principal_amount"),
    col("transaction_type"),
    col("channel"),
    col("credit_score_flag"),
    col("principal_bucket"),
    col("upi_inclined_flag")
).dropDuplicates(["customer_id"])

# Final result
result_df = loan_customer_transactions

# show sample
result_df.show(20, truncate=False)"""

try:
    ast.parse(code)
    print("Parsed successfully!")
except Exception as e:
    print(f"Error parsing: {e}")
