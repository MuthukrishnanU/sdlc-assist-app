import os
from pymongo import MongoClient

def get_schema_context(tables: list) -> str:
    mongodb_uri = os.getenv("MONGODB_URI")
    schema_context = ""
    if not mongodb_uri or not tables:
        return schema_context
        
    try:
        client = MongoClient(mongodb_uri)
        db = client["bankingSdlcDB"]
        schema_docs = list(db['semanticMetaStore'].find({"collection_name": {"$in": tables}}))
        
        schema_context_list = []
        for doc in schema_docs:
            col_name = doc.get("collection_name")
            desc = doc.get("description", "")
            pk = doc.get("primary_key", "")
            fields = doc.get("fields", [])
            
            fields_desc = []
            for f in fields:
                f_name = f.get("field_name")
                f_type = f.get("data_type")
                f_desc = f.get("description")
                fields_desc.append(f"- {f_name} ({f_type}): {f_desc}")
                
            relations = doc.get("relations", [])
            relations_desc = []
            for r in relations:
                relations_desc.append(f"Foreign key `{r.get('local_field')}` links to `{r.get('referenced_collection')}({r.get('referenced_field')})`")
                
            schema_info = f"Table: {col_name}\nDescription: {desc}\nPrimary Key: {pk}\nColumns:\n" + "\n".join(fields_desc)
            if relations_desc:
                schema_info += "\nRelations:\n" + "\n".join(relations_desc)
            schema_context_list.append(schema_info)
        
        if schema_context_list:
            schema_context = "\n\n=== Table Schemas ===\n" + "\n\n".join(schema_context_list)
    except Exception as e:
        print(f"Failed to fetch schemas: {e}")
        
    return schema_context
