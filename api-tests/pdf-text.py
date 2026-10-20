import json
import sys
from pypdf import PdfReader

reader = PdfReader(sys.argv[1])
print(json.dumps({"pages": len(reader.pages), "text": "\n".join(page.extract_text() or "" for page in reader.pages)}, ensure_ascii=True))
