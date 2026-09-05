import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PBKDF2_ITERATIONS = 100000;
const DATABASE_NAME = 'geelarkflows_payment';

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function promptHidden(message) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('This command requires an interactive terminal so the password can remain hidden.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const input = process.stdin;

    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Password reset cancelled.'));
          return;
        }

        if (character === '\r' || character === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }

        if (character === '\u0008' || character === '\u007f') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }

        if (character >= ' ') {
          value += character;
          process.stdout.write('*');
        }
      }
    };

    process.stdout.write(message);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

function isStrongPassword(password) {
  return password.length >= 12
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function main() {
  const email = readArgument('--email').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Usage: npm run admin:reset-password -- --email admin@example.com --remote');
  }

  if (!process.argv.includes('--remote')) {
    throw new Error('Pass --remote to confirm that the production D1 database is the intended target.');
  }

  const password = await promptHidden('New administrator password: ');
  const confirmation = await promptHidden('Confirm new password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  if (!isStrongPassword(password)) {
    throw new Error('Use at least 12 characters with upper/lowercase letters, a number, and a symbol.');
  }

  const passwordHash = hashPassword(password);
  const escapedEmail = email.replaceAll("'", "''");
  const sql = `UPDATE admin_users SET password_hash = '${passwordHash}', updated_at = CURRENT_TIMESTAMP WHERE email = '${escapedEmail}' RETURNING email`;
  const wranglerCli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [wranglerCli, 'd1', 'execute', DATABASE_NAME, '--remote', '--command', sql, '--json'],
    { cwd: process.cwd(), encoding: 'utf8', shell: false },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Wrangler exited with status ${result.status}.`);
  }

  let response;
  try {
    response = JSON.parse(result.stdout);
  } catch {
    throw new Error('Wrangler returned an unexpected response; verify the account in D1 before logging in.');
  }

  const updatedRows = Array.isArray(response)
    ? response.flatMap((entry) => Array.isArray(entry?.results) ? entry.results : [])
    : [];
  if (!updatedRows.some((row) => row?.email === email)) {
    throw new Error(`No administrator account matched ${email}; no password was changed.`);
  }

  console.log(`Administrator password reset completed for ${email}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
