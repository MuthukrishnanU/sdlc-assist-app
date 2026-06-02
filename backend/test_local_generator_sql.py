import asyncio
import os
from dotenv import load_dotenv
from app.generator import generator
from app.schemas import CodeGenerationRequest

load_dotenv()

async def test_format(format_name, model_name):
    request = CodeGenerationRequest(
        format=format_name,
        tables=['customerDetails', 'accountBalances', 'loanInfo', 'transactionsInfo'],
        columns=['customer_id', 'first_name', 'last_name', 'merchant_name', 'loan_type', 'loan_status', 'principal_amount', 'credit_score', 'channel', 'transaction_type'],
        logic='Prepare a table with customer name where loan type is Home Loan and status is Active. Also create a flag on credit score where credit score is less than 650 - Risky, 651-750 - Average, 750-850 - Good, >850 - Excellent. Also, if principal amount is less than 1000000 - low bucket, if principal amount is between 1000000 - 5000000 - medium bucket, if principal amount is greater than 5000000 - high bucket. Prepare a table also to highlight the customer which are doing more than 10 UPI transactions as UPI inclined customers. Please add this flag into main output dataset and give the name as "loan_customer_transactions".',
        sample_data_size=1000,
        model=model_name
    )
    
    result = await generator.generate(request)
    print(f"=== {format_name} ({model_name}) ===")
    print(result.generated_code)
    print("\n" + "="*40 + "\n")

async def main():
    await test_format('SQL', 'llama')
    await test_format('SparkSQL', 'llama')

if __name__ == '__main__':
    asyncio.run(main())
