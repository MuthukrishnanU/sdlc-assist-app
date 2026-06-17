import ast

generated_code = """from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, when, lit, row_number, max as spark_max
from pyspark.sql.window import Window

# Initialize Spark session
spark = SparkSession.builder.appName("LoanCustomerTransactions").getOrCreate()

# Read tables
customerDetails = spark.table("customerDetails")
accountBalances = spark.table("accountBalances")
loanInfo = spark.table("loanInfo")
transactionsInfo = spark.table("transactionsInfo")

# Step 1: Identify UPI inclined customers (customers with >= 10 UPI transactions)
upi_transactions = transactionsInfo.filter(col("channel") == "UPI")

upi_customer_counts = upi_transactions.groupBy("customer_id").agg(
    count("*").alias("upi_transaction_count")
)

upi_inclined_customers = upi_customer_counts.filter(col("upi_transaction_count") >= 10).select(
    "customer_id",
    lit(True).alias("upi_inclined")
)

# Step 2: Aggregate loan information at customer level to avoid duplication
# For customers with multiple loans, we aggregate principal_amount and prioritize Active loans
loan_window = Window.partitionBy("customer_id").orderBy(
    when(col("loan_status") == "Active", 0).otherwise(1),
    col("principal_amount").desc()
)

loan_ranked = loanInfo.withColumn("loan_rank", row_number().over(loan_window))

loan_agg = loan_ranked.filter(col("loan_rank") == 1).select(
    "customer_id",
    "loan_type",
    "loan_status",
    "principal_amount"
)

# Step 3: Aggregate transaction information at customer level
# Get the most recent transaction details for each customer to avoid row explosion
trans_window = Window.partitionBy("customer_id").orderBy(col("timestamp").desc())

trans_ranked = transactionsInfo.withColumn("trans_rank", row_number().over(trans_window))

latest_trans = trans_ranked.filter(col("trans_rank") == 1).select(
    "customer_id",
    "transaction_type",
    "channel",
    "merchant_name"
)

# Step 4: Join all tables together
# Start with customerDetails as base (left joins to preserve all customers)
result_df = customerDetails.select(
    "customer_id",
    "first_name",
    "last_name",
    "credit_score"
)

# Join with loan information (left join)
result_df = result_df.join(loan_agg, "customer_id", "left")

# Join with latest transaction information (left join)
result_df = result_df.join(latest_trans, "customer_id", "left")

# Join with UPI inclined flag (left join)
result_df = result_df.join(upi_inclined_customers, "customer_id", "left")

# Add UPI inclined flag with default False for customers not meeting criteria
result_df = result_df.withColumn(
    "upi_inclined",
    when(col("upi_inclined").isNull(), lit(False)).otherwise(col("upi_inclined"))
)

# Step 5: Project all required columns
result_df = result_df.select(
    "customer_id",
    "first_name",
    "last_name",
    "merchant_name",
    "loan_type",
    "loan_status",
    "credit_score",
    "principal_amount",
    "transaction_type",
    "channel",
    "upi_inclined"
)

# Step 6: Deduplicate by customer_id to prevent row duplication
result_df = result_df.dropDuplicates(["customer_id"])

# Rename output dataset as specified
loan_customer_transactions = result_df

# Display results
loan_customer_transactions.show(20, truncate=False)

# Print schema
loan_customer_transactions.printSchema()

# Data Quality checks
dq_row_count = loan_customer_transactions.count()
dq_null_values = loan_customer_transactions.select(
    [count(when(col(c).isNull(), c)).alias(c) for c in loan_customer_transactions.columns]
).collect()[0].asDict().values()
dq_total_nulls = sum(dq_null_values)

# Check for duplicates after deduplication
dq_duplicates = loan_customer_transactions.groupBy("customer_id").count().filter(col("count") > 1).count()

# Numeric stats for principal_amount and credit_score
numeric_stats = loan_customer_transactions.select(
    spark_max("principal_amount").alias("max_principal"),
    spark_max("credit_score").alias("max_credit_score")
).collect()[0]

print(f"Row count: {dq_row_count}")
print(f"Total null values: {dq_total_nulls}")
print(f"Duplicate rows: {dq_duplicates}")
print(f"Max principal_amount: {numeric_stats['max_principal']}")
print(f"Max credit_score: {numeric_stats['max_credit_score']}")
"""

try:
    ast.parse(generated_code)
    print("SUCCESS: Code parsed correctly!")
except Exception as e:
    print(f"FAILED: {e}")
