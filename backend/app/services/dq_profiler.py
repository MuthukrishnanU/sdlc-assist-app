import json
import pandas as pd

def calculate_col_dq(records: list, col: str) -> dict:
    import re
    import numpy as np
    
    if not records:
        return {
            "row_count": 0, "null_values": 0, "duplicate_rows": 0,
            "minimum": None, "maximum": None, "average": None,
            "distinct_values": 0, "empty_strings": 0,
            "min": None, "max": None, "mean": None,
            "sum": 0.0, "median": None, "stddev": 0.0,
            "variance": 0.0, "zero_count": 0, "negative_value_count": 0,
            "special_character_count": 0, "percentiles": "-",
            "percentile_25": None, "percentile_50": None, "percentile_75": None
        }
        
    series = pd.Series([r.get(col) for r in records])
    row_count = len(series)
    
    # Null / Empty String checks
    null_mask = series.isna() | (series.astype(str) == "")
    null_count = int(null_mask.sum())
    
    # Empty strings (spaces only)
    is_str = series.apply(lambda x: isinstance(x, str))
    empty_string_count = int((is_str & (series.astype(str).str.strip() == "") & ~null_mask).sum())
    
    # Non-null values
    non_null_series = series[~null_mask]
    distinct_values_count = non_null_series.nunique()
    duplicate_count = len(non_null_series) - distinct_values_count
    
    # Convert booleans to float explicitly to avoid numpy subtraction errors in quantile calculations
    float_series = non_null_series.apply(lambda x: float(x) if isinstance(x, bool) else x)
    numeric_series = pd.to_numeric(float_series, errors='coerce')
    numeric_series = numeric_series.dropna()
    
    minimum = float(numeric_series.min()) if not numeric_series.empty else None
    maximum = float(numeric_series.max()) if not numeric_series.empty else None
    average = round(float(numeric_series.mean()), 2) if not numeric_series.empty else None
    sum_val = round(float(numeric_series.sum()), 2) if not numeric_series.empty else 0.0
    
    median_val = None
    stddev_val = None
    variance_val = None
    p25 = None
    p50 = None
    p75 = None
    percentiles_str = "-"
    
    if not numeric_series.empty:
        median_val = round(float(numeric_series.median()), 2)
        stddev_val = round(float(numeric_series.std()), 2) if len(numeric_series) > 1 else 0.0
        variance_val = round(float(numeric_series.var()), 2) if len(numeric_series) > 1 else 0.0
        p25 = round(float(numeric_series.quantile(0.25)), 2)
        p50 = round(float(numeric_series.quantile(0.50)), 2)
        p75 = round(float(numeric_series.quantile(0.75)), 2)
        percentiles_str = f"25%: {p25}, 50%: {p50}, 75%: {p75}"
        
    zero_count = int((numeric_series == 0.0).sum())
    # Check string zero if not parsed
    zero_count += int((non_null_series.astype(str).str.strip().isin(["0", "0.0"]) & ~non_null_series.index.isin(numeric_series.index)).sum())
    
    negative_count = int((numeric_series < 0.0).sum())
    
    # Special characters
    non_null_str = non_null_series.astype(str)
    special_char_count = int(non_null_str.str.contains(r'[^a-zA-Z0-9\s.,?!-]', regex=True).sum())

    return {
        # Defaults
        "row_count": row_count,
        "null_values": null_count,
        "duplicate_rows": duplicate_count,
        "minimum": minimum,
        "maximum": maximum,
        "average": average,
        "distinct_values": distinct_values_count,
        "empty_strings": empty_string_count,
        
        # Variations for defaults
        "min": minimum,
        "max": maximum,
        "mean": average,
        
        # Sum
        "sum": sum_val,
        
        # Median
        "median": median_val,
        
        # Standard Deviation
        "stddev": stddev_val,
        "standard_deviation": stddev_val,
        "standard_deviation_variance": stddev_val,
        "standard_deviation_&_variance": stddev_val,
        
        # Variance
        "variance": variance_val,
        
        # Zeros
        "zero_count": zero_count,
        "zeros": zero_count,
        "zero": zero_count,
        
        # Negatives
        "negative_value_count": negative_count,
        "negative_values": negative_count,
        "negatives": negative_count,
        "negative": negative_count,
        
        # Special characters
        "special_character_count": special_char_count,
        "special_characters": special_char_count,
        "special_char_count": special_char_count,
        
        # Percentiles
        "percentiles": percentiles_str,
        "percentile_25": p25,
        "percentile_50": p50,
        "percentile_75": p75,
        "25th_percentile": p25,
        "50th_percentile": p50,
        "75th_percentile": p75
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
