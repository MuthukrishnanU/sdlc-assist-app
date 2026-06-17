import re
import ast

def clean_procedural_sql(code: str) -> str:
    code_upper = code.upper()
    if "DECLARE" not in code_upper or "BEGIN" not in code_upper:
        return code
        
    try:
        # Extract DECLARE and BEGIN sections
        declare_match = re.search(r'DECLARE(.*?)BEGIN', code, re.DOTALL | re.IGNORECASE)
        begin_match = re.search(r'BEGIN(.*?)END', code, re.DOTALL | re.IGNORECASE)
        
        if not declare_match or not begin_match:
            return code
            
        declare_section = declare_match.group(1)
        begin_section = begin_match.group(1).strip()
        
        # Parse variables: name and value
        vars_dict = {}
        for stmt in declare_section.split(';'):
            stmt = stmt.strip()
            if not stmt:
                continue
            
            # Clean comments
            stmt = re.sub(r'--.*$', '', stmt, flags=re.MULTILINE)
            stmt = re.sub(r'/\*.*?\*/', '', stmt, flags=re.DOTALL)
            stmt = stmt.strip()
            if not stmt:
                continue
                
            # If it's a CURSOR declaration, we don't treat it as a standard variable
            if re.match(r'^\s*CURSOR\b', stmt, re.IGNORECASE):
                continue
                
            lhs, rhs = None, None
            if ':=' in stmt:
                parts = stmt.split(':=', 1)
                lhs, rhs = parts[0], parts[1]
            else:
                default_match = re.search(r'\bDEFAULT\b', stmt, re.IGNORECASE)
                if default_match:
                    idx = default_match.start()
                    lhs = stmt[:idx]
                    rhs = stmt[idx + 7:]
            
            if lhs and rhs:
                lhs_words = lhs.strip().split()
                if lhs_words:
                    var_name = lhs_words[0].strip()
                    var_val = rhs.strip()
                    vars_dict[var_name] = var_val
                    
        # Check if there is a cursor definition in declare_section
        cursor_match = re.search(r'\bCURSOR\s+(\w+)\s*(?:\((.*?)\))?\s*IS\s*((?:WITH|SELECT).*?)(?:;|$)', declare_section, re.DOTALL | re.IGNORECASE)
        if cursor_match:
            cursor_name = cursor_match.group(1)
            params_str = cursor_match.group(2)
            cursor_query = cursor_match.group(3).strip()
            
            # Parse cursor parameters if they exist
            param_names = []
            if params_str:
                for param in params_str.split(','):
                    param = param.strip()
                    parts = param.split()
                    if parts:
                        param_names.append(parts[0].strip())
            
            # If cursor has parameters, try to find invocation arguments in BEGIN block
            if param_names:
                invoc_match = re.search(rf'\b{re.escape(cursor_name)}\s*\((.*?)\)', begin_section, re.IGNORECASE)
                if invoc_match:
                    args_str = invoc_match.group(1)
                    args = [a.strip() for a in args_str.split(',')]
                    for p_name, p_val in zip(param_names, args):
                        cursor_query = re.sub(rf'\b{re.escape(p_name)}\b', p_val, cursor_query)
            
            # Replace variables in the cursor query
            for var_name, var_val in vars_dict.items():
                cursor_query = re.sub(rf'\b{re.escape(var_name)}\b', var_val, cursor_query)
                
            # Remove any trailing INTO clauses if they exist
            cursor_query = re.sub(r'\bINTO\s+.*?\s+(?=\bFROM\b)', '', cursor_query, flags=re.IGNORECASE)
            
            # Remove trailing semicolon
            if cursor_query.endswith(';'):
                cursor_query = cursor_query[:-1].strip()
                
            return cursor_query
                    
        # Replace variables in BEGIN section
        cleaned_sql = begin_section
        for var_name, var_val in vars_dict.items():
            # Use word boundaries to replace variables safely
            cleaned_sql = re.sub(rf'\b{re.escape(var_name)}\b', var_val, cleaned_sql)
            
        # If there's a SELECT statement inside, extract it
        select_match = re.search(r'((?:WITH|SELECT)\b.*)', cleaned_sql, re.DOTALL | re.IGNORECASE)
        if select_match:
            cleaned_sql = select_match.group(1).strip()
            
        # Remove any trailing INTO clauses if they exist (e.g., SELECT ... INTO ... FROM ...)
        cleaned_sql = re.sub(r'\bINTO\s+.*?\s+(?=\bFROM\b)', '', cleaned_sql, flags=re.IGNORECASE)
        
        # Remove trailing semicolon if present
        if cleaned_sql.endswith(';'):
            cleaned_sql = cleaned_sql[:-1].strip()
            
        return cleaned_sql
    except Exception as e:
        print("PL/SQL cleaning failed:", e)
        return code


def sanitize_sql_for_duckdb(code: str) -> str:
    sql = code.strip()
    
    # 1. Handle PL/SQL procedural blocks (DECLARE/BEGIN/END, cursors)
    sql = clean_procedural_sql(sql)
    
    # 2. Extract SQL from spark.sql(...) wrappers
    if "spark.sql" in sql.lower():
        for pattern in [
            r'spark\.sql\(\s*f?["\']{3}(.*?)["\']{3}\s*\)',
            r'spark\.sql\(\s*f?["\']{1,4}(.*?)["\']{1,4}\s*\)',
            r'spark\.sql\(\s*f?["\'](.*?)["\']\s*\)',
        ]:
            m = re.search(pattern, sql, re.DOTALL | re.IGNORECASE)
            if m:
                sql = m.group(1).strip()
                break
    
    # 3. Peel enclosing quote wrappers
    while True:
        if sql.startswith("'''") and sql.endswith("'''"):
            sql = sql[3:-3].strip()
        elif sql.startswith('"""') and sql.endswith('"""'):
            sql = sql[3:-3].strip()
        elif len(sql) > 2 and sql[0] in ("'", '"') and sql[-1] == sql[0]:
            sql = sql[1:-1].strip()
        else:
            break
    
    # 4. Strip Python comments (lines starting with #) and import/print lines
    lines = sql.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('#'):
            continue
        if stripped.startswith('import ') or stripped.startswith('from '):
            continue
        if stripped.startswith('print(') or stripped.startswith('print ('):
            continue
        # Skip pure Python variable assignments that are NOT SQL aliases
        if re.match(r'^[a-zA-Z_]\w*\s*=\s*(?!.*\bSELECT\b)', stripped, re.IGNORECASE):
            continue
        cleaned_lines.append(line)
    sql = '\n'.join(cleaned_lines).strip()
    
    # 5. If there's a SELECT statement buried in the text, extract it
    if not sql.upper().startswith('SELECT') and not sql.upper().startswith('WITH'):
        select_match = re.search(r'((?:WITH|SELECT)\b.*)', sql, re.DOTALL | re.IGNORECASE)
        if select_match:
            sql = select_match.group(1).strip()
    
    # 6. Remove trailing semicolons
    sql = sql.rstrip(';').strip()
    
    # 7. Convert Spark/MySQL DATE_FORMAT functions to DuckDB strftime
    def replace_date_format(match):
        col_expr = match.group(1).strip()
        fmt = match.group(2)
        fmt_trans = fmt.replace('yyyy', '%Y').replace('YYYY', '%Y')
        fmt_trans = fmt_trans.replace('MM', '%m').replace('mm', '%m')
        fmt_trans = fmt_trans.replace('dd', '%d').replace('DD', '%d')
        return f"strftime({col_expr}, '{fmt_trans}')"
        
    sql = re.sub(r'\bdate_format\(\s*([^,]+)\s*,\s*["\']([^"\']+)["\']\s*\)', replace_date_format, sql, flags=re.IGNORECASE)
    
    return sql


def _pyspark_code_to_sql(code_str: str, table_names: list) -> str:
    try:
        def extract_method_args(method_name: str) -> str:
            idx = code_str.find(f".{method_name}(")
            if idx == -1:
                return None
            start_pos = idx + len(method_name) + 2
            paren_count = 1
            for i in range(start_pos, len(code_str)):
                char = code_str[i]
                if char == '(':
                    paren_count += 1
                elif char == ')':
                    paren_count -= 1
                    if paren_count == 0:
                        return code_str[start_pos:i]
            return None

        def split_args(args_str: str) -> list:
            parts = []
            current = []
            paren_count = 0
            in_quote = None
            for char in args_str:
                if in_quote:
                    if char == in_quote:
                        in_quote = None
                    current.append(char)
                elif char in ['"', "'"]:
                    in_quote = char
                    current.append(char)
                elif char == '(':
                    paren_count += 1
                    current.append(char)
                elif char == ')':
                    paren_count -= 1
                    current.append(char)
                elif char == ',' and paren_count == 0:
                    parts.append("".join(current).strip())
                    current = []
                else:
                    current.append(char)
            if current:
                parts.append("".join(current).strip())
            return parts

        for pattern in [
            r'spark\.sql\(\s*f?["\']{3}(.*?)["\']{3}\s*\)',
            r'spark\.sql\(\s*f?["\']{1,4}(.*?)["\']{1,4}\s*\)',
            r'spark\.sql\(\s*f?["\'](.*?)["\']\s*\)',
        ]:
            m = re.search(pattern, code_str, re.DOTALL | re.IGNORECASE)
            if m:
                sql = m.group(1).strip().strip("'\"").strip()
                if sql:
                    return sql
        
        table_match = re.search(r'spark\.(?:read\.)?table\(\s*["\'](\w+)["\']\s*\)', code_str)
        if not table_match:
            primary_table = None
            for tn in table_names:
                if tn in code_str:
                    primary_table = tn
                    break
            if not primary_table:
                return None
        else:
            primary_table = table_match.group(1)
        
        select_cols = "*"
        where_clause = ""
        join_clause = ""
        group_clause = ""
        having_clause = ""
        order_clause = ""
        limit_clause = ""
        distinct = ""
        
        raw_cols = extract_method_args("select")
        if raw_cols is not None:
            cols = re.sub(r'(?:F\.)?col\(\s*["\']?(\w+)["\']?\s*\)', r'\1', raw_cols)
            cols = re.sub(r'\b\w+\[\s*["\']?(\w+)["\']?\s*\]', r'\1', cols)
            cols = re.sub(r'\b\w+_df\.(\w+)', r'\1', cols)
            cols = re.sub(r'\bdf\.(\w+)', r'\1', cols)
            cols = re.sub(r'\.alias\(\s*["\'](\w+)["\']\s*\)', r' AS \1', cols)
            cols = re.sub(r'["\'](\w+)["\']', r'\1', cols)
            select_cols = cols.strip().rstrip(',')
        
        where_conditions = []
        
        def clean_cond(cond_str: str) -> str:
            c = cond_str.strip()
            c = re.sub(r'([=!<>]+)\s*["\']([^"\']+)["\']', r"\1 '\2'", c)
            c = re.sub(r'(?:F\.)?col\(\s*["\']?(\w+)["\']?\s*\)', r'"\1"', c)
            c = re.sub(r'\b\w+\[\s*["\']?(\w+)["\']?\s*\]', r'"\1"', c)
            c = re.sub(r'\b\w+_df\.(\w+)', r'"\1"', c)
            c = re.sub(r'\bdf\.(\w+)', r'"\1"', c)
            c = c.replace('==', '=')
            c = c.replace('!=', '<>')
            c = re.sub(r'\s*&\s*', ' AND ', c)
            c = re.sub(r'\s*\|\s*', ' OR ', c)
            return c

        idx = 0
        while True:
            next_filter = code_str.find(".filter(", idx)
            next_where = code_str.find(".where(", idx)
            found_idx = -1
            method_name = ""
            if next_filter != -1 and next_where != -1:
                if next_filter < next_where:
                    found_idx = next_filter
                    method_name = "filter"
                else:
                    found_idx = next_where
                    method_name = "where"
            elif next_filter != -1:
                found_idx = next_filter
                method_name = "filter"
            elif next_where != -1:
                found_idx = next_where
                method_name = "where"
                
            if found_idx == -1:
                break
                
            start_pos = found_idx + len(method_name) + 2
            paren_count = 1
            extracted_cond = None
            for i in range(start_pos, len(code_str)):
                char = code_str[i]
                if char == '(':
                    paren_count += 1
                elif char == ')':
                    paren_count -= 1
                    if paren_count == 0:
                        extracted_cond = code_str[start_pos:i]
                        idx = i + 1
                        break
            
            if extracted_cond is not None:
                where_conditions.append(clean_cond(extracted_cond))
            else:
                break
                
        if where_conditions:
            where_clause = " WHERE " + " AND ".join(where_conditions)
        
        join_clauses = []
        idx = 0
        while True:
            found_idx = code_str.find(".join(", idx)
            if found_idx == -1:
                break
            
            start_pos = found_idx + len(".join(")
            paren_count = 1
            extracted_join = None
            for i in range(start_pos, len(code_str)):
                char = code_str[i]
                if char == '(':
                    paren_count += 1
                elif char == ')':
                    paren_count -= 1
                    if paren_count == 0:
                        extracted_join = code_str[start_pos:i]
                        idx = i + 1
                        break
            
            if extracted_join is not None:
                join_args = split_args(extracted_join)
                if len(join_args) >= 2:
                    join_table = join_args[0]
                    for filter_method in ['.filter(', '.where(']:
                        f_idx = join_table.find(filter_method)
                        if f_idx != -1:
                            f_start = f_idx + len(filter_method)
                            f_paren_count = 1
                            for i in range(f_start, len(join_table)):
                                char = join_table[i]
                                if char == '(':
                                    f_paren_count += 1
                                elif char == ')':
                                    f_paren_count -= 1
                                    if f_paren_count == 0:
                                        inner_cond = join_table[f_start:i]
                                        where_conditions.append(clean_cond(inner_cond))
                                        break
                    
                    join_table_base = join_table.split('.')[0].split('[')[0].strip()
                    clean_join_table = re.sub(r'_?df$', '', join_table_base, flags=re.IGNORECASE)
                    actual_join_table = join_table_base
                    for tn in table_names:
                        clean_tn = re.sub(r'_?df$', '', tn, flags=re.IGNORECASE)
                        if (clean_tn.lower() == clean_join_table.lower() or 
                            re.sub(r'(?<!^)(?=[A-Z])', '_', clean_tn).lower() == clean_join_table.lower()):
                            actual_join_table = tn
                            break
                    
                    join_cond_raw = join_args[1]
                    join_type = "inner"
                    if len(join_args) >= 3:
                        join_type_raw = join_args[2]
                        join_type_raw = re.sub(r'^how\s*=\s*', '', join_type_raw, flags=re.IGNORECASE)
                        join_type = join_type_raw.strip('"\'')
                    join_type = join_type.upper()
                    
                    join_cond_clean = re.sub(r'^on\s*=\s*', '', join_cond_raw.strip(), flags=re.IGNORECASE)
                    single_col_match = re.match(r'^["\']?(\w+)["\']?$', join_cond_clean.strip())
                    if single_col_match:
                        col_name = single_col_match.group(1)
                        join_clauses.append(f" {join_type} JOIN \"{actual_join_table}\" USING ({col_name})")
                    else:
                        join_cond = clean_cond(join_cond_clean)
                        join_clauses.append(f" {join_type} JOIN \"{actual_join_table}\" ON {join_cond}")
            else:
                break
                
        join_clause = "".join(join_clauses)
        
        raw_groupby = extract_method_args("groupBy")
        raw_agg = extract_method_args("agg")
        if raw_groupby is not None and raw_agg is not None:
            group_cols = re.sub(r'(?:F\.)?col\(\s*["\']?(\w+)["\']?\s*\)', r'"\1"', raw_groupby)
            group_cols = re.sub(r'["\'](\w+)["\']', r'"\1"', group_cols)
            group_clause = f" GROUP BY {group_cols}"
            
            agg_parts = []
            for agg_func in ['sum', 'count', 'avg', 'min', 'max', 'mean']:
                for m in re.finditer(rf'(?:F\.)?{agg_func}\(\s*(?:(?:F\.)?col\(\s*)?["\']?(\w+)["\']?\s*\)?\s*\)(?:\.alias\(\s*["\'](\w+)["\']\s*\))?', raw_agg, re.IGNORECASE):
                    col_name = m.group(1)
                    alias = m.group(2) or f"{agg_func}_{col_name}"
                    sql_func = "AVG" if agg_func == "mean" else agg_func.upper()
                    agg_parts.append(f'{sql_func}("{col_name}") AS "{alias}"')
            
            if agg_parts:
                select_cols = f'{group_cols}, {", ".join(agg_parts)}'
        
        for method in ['orderBy', 'sort']:
            raw_order = extract_method_args(method)
            if raw_order is not None:
                order_cols = re.sub(r'(?:F\.)?col\(\s*["\']?(\w+)["\']?\s*\)', r'"\1"', raw_order)
                order_cols = re.sub(r'(?:F\.)?desc\(\s*["\']?(\w+)["\']?\s*\)', r'"\1" DESC', order_cols)
                order_cols = re.sub(r'(?:F\.)?asc\(\s*["\']?(\w+)["\']?\s*\)', r'"\1" ASC', order_cols)
                order_cols = re.sub(r'["\']?(\w+)["\']?\.desc\(\)', r'"\1" DESC', order_cols)
                order_cols = re.sub(r'["\']?(\w+)["\']?\.asc\(\)', r'"\1" ASC', order_cols)
                order_clause = f" ORDER BY {order_cols}"
                break
        
        raw_limit = extract_method_args("limit")
        if raw_limit is not None:
            limit_clause = f" LIMIT {raw_limit.strip()}"
        
        if '.distinct()' in code_str:
            distinct = "DISTINCT "
        
        sql = f'SELECT {distinct}{select_cols} FROM "{primary_table}"{join_clause}{where_clause}{group_clause}{having_clause}{order_clause}{limit_clause}'
        sql = sanitize_sql_for_duckdb(sql)
        return sql
    except Exception as e:
        print(f"[INFO] PySpark-to-SQL conversion failed: {e}")
        return None
