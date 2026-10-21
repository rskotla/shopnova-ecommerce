import os
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"

from backend.app import app

def test_health():
    client = app.test_client()
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json["status"] == "ok"

def test_products():
    client = app.test_client()
    response = client.get("/api/products")
    assert response.status_code == 200
    assert len(response.json) >= 1
