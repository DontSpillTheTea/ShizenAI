from fastapi.testclient import TestClient
from main import app
import time

client = TestClient(app)

print("Authenticating...")
res = client.post("/api/v1/auth/token", data={"username": "admin", "password": "password"})
token = res.json().get("access_token")

if not token:
    print("Failed to login:", res.json())
    exit(1)

print("Dispatching Atomic Document Ingestion...")
with open("pumpkin_pie.pdf", "rb") as f:
    start = time.time()
    res = client.post("/api/v1/admin/upload", 
        files={"file": ("pumpkin_pie.pdf", f, "application/pdf")}, 
        data={"topic_title": "Cooking"}, 
        headers={"Authorization": f"Bearer {token}"}
    )
    
print("Result:", res.json())
print(f"Total Time: {time.time() - start:.2f} seconds")
