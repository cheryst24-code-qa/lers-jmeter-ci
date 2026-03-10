#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// === Настройки по умолчанию ===
const CONFIG = {
  jmeterHome: 'D:\\JMeter\\apache-jmeter-5.6.3',
  testFile: 'LERS_Auth_Test_CI.jmx',
  threads: 1,
  iterations: 1
};

// === Парсинг .env.local ===
function loadEnvLocal() {
  const envPath = path.join(__dirname, 'jmeter-tests', 'test-data', '.env.local');
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    });
  }
  return env;
}

// === Парсинг secrets.csv ===
function loadSecretsCsv() {
  const csvPath = path.join(__dirname, 'jmeter-tests', 'test-data', 'secrets.csv');
  const secrets = {};
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n');
    if (lines.length >= 2) {
      const headers = lines[0].split(',').map(h => h.trim());
      const values = lines[1].split(',').map(v => v.trim());
      headers.forEach((header, index) => {
        secrets[header] = values[index] || '';
      });
    }
  }
  return secrets;
}

// === Парсинг аргументов командной строки ===
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...CONFIG };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const [key, value] = arg.split('=');
    switch (key) {
      case '--jmeter-home': case '-j': config.jmeterHome = value; break;
      case '--test-file': case '-t': config.testFile = value; break;
      case '--threads': case '-n': config.threads = parseInt(value, 10); break;
      case '--iterations': case '-i': config.iterations = parseInt(value, 10); break;
      case '--telegram': case '-tg': config.telegramChatId = value; break;
      case '--help': case '-h': printHelp(); process.exit(0);
    }
  }
  return config;
}

function printHelp() {
  console.log(`
Использование: node run.js [опции]

Опции:
  -j, --jmeter-home    Путь к папке JMeter
  -t, --test-file      Имя файла теста (по умолчанию: LERS_Auth_Test_CI.jmx)
  -n, --threads        Количество потоков (по умолчанию: 1)
  -i, --iterations     Количество итераций (по умолчанию: 1)
  -tg, --telegram      Chat ID для отправки в Telegram
  -h, --help           Показать эту справку

Примеры:
  node run.js
  node run.js --threads=100
  node run.js -n=50 -tg=123456789
`);
}

// === Основная функция ===
async function main() {
  const cliConfig = parseArgs();
  const env = loadEnvLocal();
  const secrets = loadSecretsCsv();

  const baseUrl = secrets.base_url;
  const basePort = secrets.base_port || '10000';
  
  if (!baseUrl) {
    console.error('❌ base_url не найден в secrets.csv!');
    process.exit(1);
  }

  const telegramToken = env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = cliConfig.telegramChatId || env.TELEGRAM_CHAT_ID;

  const TEST_DIR = path.join(__dirname, 'jmeter-tests');
  const JMETER_BIN = process.platform === 'win32' 
    ? path.join(cliConfig.jmeterHome, 'bin', 'jmeter.bat')
    : path.join(cliConfig.jmeterHome, 'bin', 'jmeter.sh');

  const RESULT_FILE = 'result.jtl';
  const REPORT_DIR = 'report';

  if (!fs.existsSync(JMETER_BIN)) {
    console.error(`❌ JMeter не найден: ${JMETER_BIN}`);
    process.exit(1);
  }

  const resultPath = path.join(TEST_DIR, RESULT_FILE);
  const reportPath = path.join(TEST_DIR, REPORT_DIR);

  if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);
  if (fs.existsSync(reportPath)) fs.rmSync(reportPath, { recursive: true, force: true });

  const jmeterProps = [
    `-Jbase_url=${baseUrl}`,
    `-Jbase_port=${basePort}`,
    `-Jthreads=${cliConfig.threads}`,
    `-Jiterations=${cliConfig.iterations}`
  ].join(' ');

  const jmeterArgs = [
    '-n',
    '-Djava.awt.headless=true',
    jmeterProps,
    `-t "${path.join(TEST_DIR, cliConfig.testFile)}"`,
    `-l "${resultPath}"`,
    `-e -o "${reportPath}"`
  ].join(' ');

  const command = `"${JMETER_BIN}" ${jmeterArgs}`;

  console.log('Запуск JMeter...');
  console.log(`Тест: ${cliConfig.testFile} | Потоки: ${cliConfig.threads} | Итерации: ${cliConfig.iterations}`);
  console.log(`Base URL: ${baseUrl}:${basePort}`);

  try {
    execSync(command, { 
      cwd: TEST_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32' ? 'cmd' : '/bin/bash'
    });
    
    console.log('\n✅ Тест завершён!');
    
    if (telegramChatId && telegramToken) {
      await sendTelegramReport(telegramChatId, telegramToken, reportPath, cliConfig);
    }
    
    openReport(reportPath);
    
  } catch (error) {
    console.error('\n❌ Тест завершился с ошибкой!');
    process.exit(1);
  }
}

// === Отправка в Telegram ===
async function sendTelegramReport(chatId, token, reportPath, config) {
  try {
    const statsPath = path.join(reportPath, 'statistics.json');
    if (!fs.existsSync(statsPath)) throw new Error('Файл statistics.json не найден');

    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    
    let avgTime = 0, errorPercent = 0, totalSamples = 0, errorCount = 0;
    
    // Структура JMeter 5.6.3: stats.Total.*
    if (stats.Total) {
      avgTime = stats.Total.meanResTime || 0;
      errorPercent = stats.Total.errorPct || 0;
      totalSamples = stats.Total.sampleCount || 0;
      errorCount = stats.Total.errorCount || 0;
    }
    // Fallback на другие форматы
    else if (stats.overall) {
      avgTime = stats.overall.avgResponseTime || stats.overall.average || 0;
      errorPercent = stats.overall.errorPercent || stats.overall.errorPercentage || 0;
    }
    else if (stats.meanResTime !== undefined) {
      avgTime = stats.meanResTime;
      errorPercent = stats.errorPct || stats.errorPercent || 0;
    }
    
    // Fallback на summary.json
    if (avgTime === 0 && fs.existsSync(path.join(reportPath, 'summary.json'))) {
      const summary = JSON.parse(fs.readFileSync(path.join(reportPath, 'summary.json'), 'utf8'));
      avgTime = summary.averageTime || summary.meanResTime || 0;
      errorPercent = summary.errorPercentage || summary.errorPct || 0;
    }
    
    // Ручной расчёт процента ошибок
    if (errorPercent === 0 && totalSamples > 0 && errorCount > 0) {
      errorPercent = (errorCount / totalSamples) * 100;
    }
    
    const isFailed = errorPercent > 0 || avgTime > 5000;
    const statusEmoji = isFailed ? '❌' : '✅';
    const statusText = isFailed ? 'ПРОВАЛЕН' : 'ПРОЙДЕН';
    
    const message = `
${statusEmoji} *Нагрузочный тест ${statusText}!*
Файл: \`${path.basename(config.testFile)}\`
Потоки: ${config.threads} | Итерации: ${config.iterations}
⏱ Среднее время: ${Math.round(avgTime)} мс
❗ Ошибки: ${errorPercent.toFixed(2)}%
${isFailed ? '\n⚠️ *Требуется внимание!*' : ''}
    `.trim();

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });
    
    console.log(`Отчёт отправлен в Telegram! [${statusText}]`);
    
  } catch (err) {
    console.error('❌ Ошибка Telegram:', err.message);
  }
}

// === Открытие отчёта ===
function openReport(reportPath) {
  const reportFile = path.join(reportPath, 'index.html');
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${reportFile}"`, { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      execSync(`open "${reportFile}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${reportFile}"`, { stdio: 'ignore' });
    }
  } catch (err) {
    console.log('Не удалось открыть отчёт автоматически');
  }
}

// === Запуск ===
main().catch(err => {
  console.error('❌ Критическая ошибка:', err.message);
  process.exit(1);
});