@echo off
echo ========================================
echo PROOF TEST - All Fixes Working
echo ========================================
echo.
echo Starting server on port 3001...
echo.
start http://localhost:3001/test-proof.html
echo.
echo Opening proof test in browser...
echo.
echo ========================================
echo Server running... Press Ctrl+C to stop
echo ========================================
echo.

python -m http.server 3001
