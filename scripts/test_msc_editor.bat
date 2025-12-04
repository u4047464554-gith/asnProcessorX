@echo off
REM Test script for MSC Editor functionality (Windows)
REM This script runs all MSC-related tests to validate design and catch regressions

echo 🧪 Running MSC Editor Tests...
echo ================================
echo.

REM Change to frontend directory
cd /d "%~dp0..\frontend"

echo 📦 Installing dependencies (if needed)...
call npm install --silent

echo.
echo 🔍 Running MSC Editor component tests...
call npm run test -- src/pages/MscEditor.test.tsx --reporter=verbose

echo.
echo 🔍 Running useMscEditor hook tests...
call npm run test -- src/hooks/useMscEditor.test.tsx --reporter=verbose

echo.
echo ✅ All MSC Editor tests completed!
echo.
echo To run tests in watch mode:
echo   cd frontend ^&^& npm run test:watch

