"""
Run script for CircleChat backend
This ensures the server runs on 0.0.0.0 for network access
"""
import uvicorn

if __name__ == "__main__":
    # Run on 0.0.0.0 to allow access from network devices
    # Accessible on:
    # - http://localhost:8000 (local)
    # - http://127.0.0.1:8000 (local)
    # - http://192.168.31.112:8000 (network - use your actual IP)
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # Listen on all network interfaces
        port=8000,
        reload=True,  # Enable auto-reload in development
        log_level="info"
    )

