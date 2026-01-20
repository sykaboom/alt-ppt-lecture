@echo off
setlocal
set "ROOT=%~dp0"
pushd "%ROOT%" >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%build-windows.ps1"
set "CODE=%ERRORLEVEL%"
popd >nul
if %CODE% neq 0 (
  echo.
  echo Build failed.
  pause
  exit /b %CODE%
)
echo.
echo Build finished.
pause
