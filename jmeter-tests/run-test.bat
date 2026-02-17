@echo off
setlocal

REM === Настройки ===
set JMETER_HOME=D:\apache-jmeter-5.6.3
set TEST_DIR=%~dp0

REM === Очистка старых результатов ===
if exist "%TEST_DIR%result.jtl" del /f /q "%TEST_DIR%result.jtl"
if exist "%TEST_DIR%report" rd /s /q "%TEST_DIR%report"

REM === Запуск JMeter ===
echo Запуск теста...
"%JMETER_HOME%\bin\jmeter.bat" -n ^
  -Djava.awt.headless=true ^
  -t "%TEST_DIR%LERS_Auth_Test_CI.jmx" ^
  -l "%TEST_DIR%result.jtl" ^
  -e -o "%TEST_DIR%report"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Тест завершён успешно!
    echo Отчёт: %TEST_DIR%report\index.html
    start "" "%TEST_DIR%report\index.html"
) else (
    echo.
    echo ❌ Тест завершился с ошибкой!
)

pause