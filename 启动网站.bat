@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo Python 3 not found. Please install Python 3 first.
  echo.
  pause
  exit /b 1
)
python server.py
