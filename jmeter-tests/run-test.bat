@echo off
setlocal

set JMETER_HOME=D:\JMeter\apache-jmeter-5.6.3
set TEST_DIR=%~dp0

if exist "%TEST_DIR%result.jtl" del /f /q "%TEST_DIR%result.jtl"
if exist "%TEST_DIR%report" rd /s /q "%TEST_DIR%report"

"%JMETER_HOME%\bin\jmeter.bat" -n ^
  -Djava.awt.headless=true ^
  -Jbase_url=45.141.100.211 ^
  -t "%TEST_DIR%LERS_Auth_Test_CI.jmx" ^
  -l "%TEST_DIR%result.jtl" ^
  -e -o "%TEST_DIR%report"

if %ERRORLEVEL% EQU 0 (
    echo ✅ Тест завершён успешно!
    start "" "%TEST_DIR%report\index.html"
) else (
    echo ❌ Тест завершился с ошибкой!
)

pause