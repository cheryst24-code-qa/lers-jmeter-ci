Автоматизированное тестирование API ЛЭРС УЧЁТ

Данный проект содержит нагрузочные и функциональные тесты для REST API системы ЛЭРС УЧЁТ, реализованные с помощью Apache JMeter.
Тесты проверяют корректность авторизации, доступ к защищённым эндпоинтам и стабильность системы под нагрузкой.


Структура проекта

    lers-jmeter-ci/
    ├── jmeter-tests/               # Тестовые сценарии JMeter
    │   ├── LERS_Auth_Test_CI.jmx   # Основной тест: авторизация + запросы данных
    │   └── test-data/
    │       ├── secrets.csv.example  # Шаблон файла с учётными данными
    │       └── secrets.csv         # ← ДОБАВЛЕН В .gitignore (не коммитится!)
    ├── .github/workflows/
    │   └── jmeter-test.yml         # Workflow для GitHub Actions
    ├── .gitignore                  # Игнорирование секретов и временных файлов
    └── README.md                  

Требования

    Java 11+ (OpenJDK)
    Apache JMeter 5.6.3+
    Доступ к тестовому стенду ЛЭРС УЧЁТ (публичный URL или локальная сеть)

Локальный запуск

1. Подготовка

1.1. Склонируйте репозиторий:
```bash
git clone https://github.com/cheryst24-code-qa/lers-jmeter-ci.git
cd lers-jmeter-ci
```
1.2. Создайте файл с учётными данными:
```bash
cp jmeter-tests/test-data/secrets.csv.example jmeter-tests/test-data/secrets.csv
```
1.3. Отредактируйте secrets.csv, указав реальные логин и пароль:
```csv
login,password
ваш_логин,ваш_пароль
```
2. Запуск через BAT-файл (Windows)

```cmd
cd jmeter-tests
run-test.bat
```
    После завершения отчёт автоматически откроется в браузере.

3. Запуск вручную (любая ОС)

```bash
# Укажите путь к вашей установке JMeter
JMETER_HOME=/path/to/apache-jmeter-5.6.3

$JMETER_HOME/bin/jmeter -n \
  -Djava.awt.headless=true \
  -t jmeter-tests/LERS_Auth_Test_CI.jmx \
  -l jmeter-tests/result.jtl \
  -e -o jmeter-tests/report
```
    Откройте отчёт: jmeter-tests/report/index.html.

CI/CD через GitHub Actions

    Тесты автоматически запускаются при пуше в ветку main или вручную через workflow_dispatch.

    Настройка секретов:
    Перейдите в Settings -> Secrets and variables -> Actions.
    Создайте секрет SECRETS_CSV_CONTENT со значением в формате(пример):
    login,password\ninspector,test123

Результат

    После выполнения workflow:
    HTML-отчёт сохраняется как артефакт jmeter-report.
    Его можно скачать и проанализировать в разделе Actions.

Безопасность

    Никакие секреты не хранятся в репозитории:
    Реальные логины/пароли - только в локальном secrets.csv (игнорируется через .gitignore).
    В .jmx используются placeholder'ы или переменные.
    Для CI/CD данные передаются через GitHub Secrets.

Что тестируется

    | Эндпоинт | Метод | Проверка |
    |----------|-------|----------|
    | `/api/v1/Login` | POST | Успешная авторизация, получение JWT-токена |
    | `/api/v1/Login/Current`| GET | Доступ к данным текущего пользователя |
    | `/api/v1/Core/Nodes` | GET | Получение списка точек учёта |

    >  Для разработки и отладки используйте Postman, а для нагрузочного тестирования - JMeter.





