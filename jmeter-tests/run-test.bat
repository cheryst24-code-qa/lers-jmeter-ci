@echo off
REM Переключаем консоль в кодировку Windows-1251, чтобы русский текст из ANSI-файла отображался корректно
chcp 1251 >nul
setlocal EnableDelayedExpansion

REM === Настройки ===
set JMETER_HOME=D:\JMeter\apache-jmeter-5.6.3
set TEST_DIR=%~dp0
set REPORT_DIR=%TEST_DIR%report
set JTL_FILE=%TEST_DIR%result.jtl

REM === Очистка папки отчета ===
if exist "%REPORT_DIR%" (
    echo Очистка старой папки отчета...
    rd /s /q "%REPORT_DIR%" 2>nul
    if exist "%REPORT_DIR%" (
        echo Папка заблокирована. Ждем 2 секунды...
        timeout /t 2 /nobreak >nul
        rd /s /q "%REPORT_DIR%" 2>nul
        if exist "%REPORT_DIR%" (
            echo [ERROR] Не удалось удалить папку отчета. Закройте браузер и повторите попытку.
            pause
            exit /b 1
        )
    )
)

if exist "%JTL_FILE%" del /f /q "%JTL_FILE%"

REM === Запуск JMeter ===
echo Запуск теста...
echo ---------------------------------------------------

REM Используем call для возврата управления
call "%JMETER_HOME%\bin\jmeter.bat" -n ^
  -Djava.awt.headless=true ^
  -t "%TEST_DIR%LERS_Auth_Test_CI.jmx" ^
  -l "%JTL_FILE%" ^
  -e -o "%REPORT_DIR%"

REM Сразу сохраняем код ошибки
set "EXIT_CODE=!ERRORLEVEL!"

echo ---------------------------------------------------
echo Код завершения процесса: !EXIT_CODE!

REM === ПРОВЕРКА ===
if "!EXIT_CODE!"=="0" (
    goto :SUCCESS
) else (
    if exist "%REPORT_DIR%\index.html" (
        echo [WARNING] JMeter вернул код !EXIT_CODE!, но отчет создан.
        goto :SUCCESS
    ) else (
        goto :FAIL
    )
)

:SUCCESS
echo.
echo ==========================================
echo   [OK] ТЕСТ ЗАВЕРШЕН УСПЕШНО!
echo ==========================================
echo Отчет доступен: %REPORT_DIR%\index.html
echo.
start "" "%REPORT_DIR%\index.html"
goto :END

:FAIL
echo.
echo ==========================================
echo   [FAIL] ТЕСТ ПРОВАЛЕН ИЛИ ОТЧЕТ НЕ СОЗДАН!
echo ==========================================
echo Код ошибки: !EXIT_CODE!
echo Проверьте логи выше.
goto :END

:END
echo.
pause