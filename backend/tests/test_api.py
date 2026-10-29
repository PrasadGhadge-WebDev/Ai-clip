import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import UPLOAD_DIR

client = TestClient(app)

def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "ffmpeg" in data
    assert "whisper" in data
    assert "storage" in data

def test_generate_sample_and_job_lifecycle():
    # 1. Generate sample video
    sample_res = client.post("/api/system/generate-sample")
    assert sample_res.status_code == 200
    sample_data = sample_res.json()
    file_id = sample_data["file_id"]
    assert file_id is not None
    assert (UPLOAD_DIR / file_id).exists()

    # 2. Create clipping job
    job_payload = {
        "file_id": file_id,
        "cut_method": "duration",
        "aspect_ratio": "9:16",
        "crop_mode": "blur_padding",
        "resolution": "720p",
        "target_duration": 5.0,
        "min_duration": 2.0,
        "max_duration": 15.0
    }
    create_res = client.post("/api/jobs", json=job_payload)
    assert create_res.status_code == 200
    job_info = create_res.json()
    job_id = job_info["id"]
    assert job_id is not None
    assert job_info["status"] in ("queued", "analyzing", "cutting", "completed")

    # 3. Query job status
    get_res = client.get(f"/api/jobs/{job_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == job_id

    # 4. List jobs
    list_res = client.get("/api/jobs")
    assert list_res.status_code == 200
    assert any(j["id"] == job_id for j in list_res.json())

    # 5. Delete job cleanup
    del_res = client.delete(f"/api/jobs/{job_id}")
    assert del_res.status_code == 200

def test_import_video_from_url_validation():
    # Test invalid scheme
    res = client.post("/api/upload-url", json={"url": "ftp://example.com/video.mp4"})
    assert res.status_code == 400
    assert "scheme" in res.json()["detail"].lower()

    # Test empty url
    res = client.post("/api/upload-url", json={"url": "   "})
    assert res.status_code == 400

