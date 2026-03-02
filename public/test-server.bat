@echo off
echo ========================================
echo CryptoExplorer Test Suite
echo ========================================
echo.
echo Starting local server on port 3001...
echo.
echo CRITICAL FIXES APPLIED:
echo [1] TreeScreen defined check added
echo [2] FallbackTreeScreen component created
echo [3] Babel transformation removed from main.js
echo [4] Component load order verified
echo [5] getMyHustleScreen function implemented
echo [6] Safe TreeScreen getter added
echo [7] Error boundary present
echo [8] Enhanced component checking
echo [9] Synchronous script loading
echo [10] Solid background color added
echo.
echo ========================================
echo.
echo Opening test pages...
echo.
echo Test 1: Main Application
start http://localhost:3001/index.html
timeout /t 2 /nobreak >nul
echo.
echo Test 2: MyHustle Screen Test
start http://localhost:3001/test-myhustle-final.html
timeout /t 2 /nobreak >nul
echo.
echo Test 3: 10 Fixes Verification
start http://localhost:3001/test-10-fixes.html
echo.
echo ========================================
echo Server starting... Press Ctrl+C to stop
echo ========================================
echo.

cd /d "%~dp0"
python -m http.server 3001
