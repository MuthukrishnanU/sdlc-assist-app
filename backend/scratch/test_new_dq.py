import sys
import os

# Adjust path to import backend app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.dq_profiler import calculate_col_dq

records = [
    {"val": 10},
    {"val": -5},
    {"val": 0},
    {"val": 25},
    {"val": None},
    {"val": "hello!"},
    {"val": ""},
    {"val": 15}
]

res = calculate_col_dq(records, "val")
print("Results:")
for k, v in res.items():
    print(f"  {k}: {v}")
