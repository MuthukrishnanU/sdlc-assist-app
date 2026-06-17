import json
import pandas as pd

def calculate_col_dq(records: list, col: str) -> dict:
    row_count = len(records)
    null_count = sum(1 for r in records if r.get(col) is None or r.get(col) == "")
    empty_string_count = sum(1 for r in records if isinstance(r.get(col), str) and r.get(col).strip() == "")
    
    non_null_vals = [r.get(col) for r in records if r.get(col) is not None and r.get(col) != ""]
    duplicate_count = len(non_null_vals) - len(set(non_null_vals))
    distinct_values_count = len(set(non_null_vals))
    
    numeric_values = []
    for val in non_null_vals:
        try:
            numeric_values.append(float(val))
        except (ValueError, TypeError):
            pass
    
    minimum = min(numeric_values) if numeric_values else None
    maximum = max(numeric_values) if numeric_values else None
    average = round(sum(numeric_values) / len(numeric_values), 2) if numeric_values else None
    
    return {
        "row_count": row_count,
        "null_values": null_count,
        "duplicate_rows": duplicate_count,
        "minimum": minimum,
        "maximum": maximum,
        "average": average,
        "distinct_values": distinct_values_count,
        "empty_strings": empty_string_count
    }

def calculate_dataframe_dq(final_dataframe: list, column_details: dict) -> dict:
    row_count = len(final_dataframe)
    null_count = 0
    empty_strings_count = 0
    for r in final_dataframe:
        for val in r.values():
            if val is None or val == "":
                null_count += 1
            if isinstance(val, str) and val.strip() == "":
                empty_strings_count += 1

    row_strings = [json.dumps(row, default=str, sort_keys=True) for row in final_dataframe]
    duplicate_count = len(row_strings) - len(set(row_strings))
    distinct_rows_count = len(set(row_strings))

    # Find primary numeric column
    numeric_col = None
    for col, details in column_details.items():
        if details.get("role") == "measure" and details.get("data_type") in ("integer", "double", "float"):
            numeric_col = col
            break
    if not numeric_col:
        for col, details in column_details.items():
            if details.get("data_type") in ("integer", "double", "float"):
                numeric_col = col
                break

    minimum = None
    maximum = None
    average = None

    if numeric_col and final_dataframe:
        numeric_values = []
        for r in final_dataframe:
            val = r.get(numeric_col)
            if val is not None:
                try:
                    numeric_values.append(float(val))
                except (ValueError, TypeError):
                    pass
        if numeric_values:
            minimum = min(numeric_values)
            maximum = max(numeric_values)
            average = round(sum(numeric_values) / len(numeric_values), 2)

    return {
        "row_count": row_count,
        "null_values": null_count,
        "duplicate_rows": duplicate_count,
        "minimum": minimum,
        "maximum": maximum,
        "average": average,
        "distinct_values": distinct_rows_count,
        "empty_strings": empty_strings_count
    }

def calculate_table_level_dq(table_records: list, meta_fields_list: list) -> dict:
    t_row_count = len(table_records)
    t_null_count = 0
    t_empty_strings_count = 0
    for r in table_records:
        for val in r.values():
            if val is None or val == "":
                t_null_count += 1
            if isinstance(val, str) and val.strip() == "":
                t_empty_strings_count += 1

    t_row_strings = [json.dumps(row, default=str, sort_keys=True) for row in table_records]
    t_duplicate_count = len(t_row_strings) - len(set(t_row_strings))
    t_distinct_rows_count = len(set(t_row_strings))

    t_numeric_col = None
    for field in meta_fields_list:
        if field.get("role") == "measure" and field.get("data_type") in ("integer", "double", "float"):
            t_numeric_col = field.get("field_name")
            break
    if not t_numeric_col:
        for field in meta_fields_list:
            if field.get("data_type") in ("integer", "double", "float"):
                t_numeric_col = field.get("field_name")
                break

    t_minimum = None
    t_maximum = None
    t_average = None

    if t_numeric_col and table_records:
        t_numeric_values = []
        for r in table_records:
            val = r.get(t_numeric_col)
            if val is not None:
                try:
                    t_numeric_values.append(float(val))
                except (ValueError, TypeError):
                    pass
        if t_numeric_values:
            t_minimum = min(t_numeric_values)
            t_maximum = max(t_numeric_values)
            t_average = round(sum(t_numeric_values) / len(t_numeric_values), 2)

    return {
        "row_count": t_row_count,
        "null_values": t_null_count,
        "duplicate_rows": t_duplicate_count,
        "minimum": t_minimum,
        "maximum": t_maximum,
        "average": t_average,
        "distinct_values": t_distinct_rows_count,
        "empty_strings": t_empty_strings_count
    }
