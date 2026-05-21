const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function parseDotEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (val.startsWith("\"") && val.endsWith("\"")) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}

(async () => {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const env = parseDotEnv(envPath);

    const connection = await mysql.createConnection({
      host: env.DB_HOST || 'localhost',
      port: Number(env.DB_PORT) || 3306,
      user: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
    });

    const [rows] = await connection.query('SELECT 1 + 1 AS result');
    console.log('Conexión OK. Resultado de prueba:', rows[0]);
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('Fallo al conectar a la base de datos:', err.message);
    process.exit(1);
  }
})();
