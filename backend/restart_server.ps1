Write-Host "Stopping any existing backend server..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "Starting backend server..." -ForegroundColor Green
Set-Location $PSScriptRoot
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

