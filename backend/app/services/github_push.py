import io
import csv

def convert_to_csv(data):
    if not data:
        return ""
    output = io.StringIO()
    headers = data[0].keys()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    return output.getvalue()
