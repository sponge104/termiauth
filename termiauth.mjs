import inquirer from 'inquirer';
import { authenticator } from 'otplib';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { URL } from 'url';
import clipboardy from 'clipboardy';
import crypto from 'crypto';

const DATA_FILE = path.resolve('./accounts.json');
const CONFIG_FILE = path.resolve('./config.json');

let accounts = [];
let config = {
  passphraseSet: false,
  securityQuestion: "What was your first pet's name?", // change this to whatever you want
  securityAnswerHash: "",
  hashedPassphrase: "" 
};


let passphrase = '';

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    config = JSON.parse(raw);
  } catch {
    await saveConfig();
  }
}

async function saveConfig() {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function hashAnswer(answer) {
  return crypto.createHash('sha256').update(answer.toLowerCase().trim()).digest('hex');
}

function hashPassphrase(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex');
}

async function setupPassphraseAndSecurity() {
  console.log(chalk.blue('Welcome! Please set up your encryption passphrase and security question.\n'));

  const { securityAnswer } = await inquirer.prompt({
    type: 'input',
    name: 'securityAnswer',
    message: config.securityQuestion,
    validate: input => input.trim().length > 0 || 'Please enter an answer.',
  });

  config.securityAnswerHash = hashAnswer(securityAnswer);

  // First passphrase prompt
  const { passphrase1 } = await inquirer.prompt({
    type: 'password',
    name: 'passphrase1',
    message: 'Enter your encryption passphrase:',
    mask: '*',
    validate: input => input.length >= 6 || 'Passphrase must be at least 6 characters',
  });

  // Confirm passphrase prompt
  const { passphrase2 } = await inquirer.prompt({
    type: 'password',
    name: 'passphrase2',
    message: 'Confirm your encryption passphrase:',
    mask: '*',
    validate: input => input === passphrase1 || 'Passphrases do not match',
  });

  passphrase = passphrase1;
  config.hashedPassphrase = hashPassphrase(passphrase1);
  config.passphraseSet = true;
  await saveConfig();

  console.log(chalk.green('\nSetup complete! Your data will now be encrypted.\n'));
}



function getKey() {
  return crypto.createHash('sha256').update(passphrase).digest();
}

const algorithm = 'aes-256-cbc';
const ivLength = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(encryptedText) {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted data');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

async function loadAccounts() {
  try {
    const encryptedData = await fs.readFile(DATA_FILE, 'utf-8');
    const decrypted = decrypt(encryptedData);
    accounts = JSON.parse(decrypted);
  } catch (err) {
    accounts = [];
  }
}

async function saveAccounts() {
  const json = JSON.stringify(accounts, null, 2);
  const encrypted = encrypt(json);
  await fs.writeFile(DATA_FILE, encrypted, 'utf-8');
}

function printHeader() {
  console.clear();
  console.log(chalk.yellow.bold('--termiauth--'));
  console.log(chalk.gray('-----------------------------------------\n'));
}

function parseOtpauth(uri) {
  if (!uri.startsWith('otpauth://totp/')) return null;

  try {
    const url = new URL(uri);
    const label = decodeURIComponent(url.pathname.slice(1));
    let issuerFromLabel = null;
    let accountName = label;

    if (label.includes(':')) {
      const parts = label.split(':');
      issuerFromLabel = parts[0];
      accountName = parts.slice(1).join(':');
    }

    const secret = url.searchParams.get('secret');
    if (!secret) return null;

    const issuerFromParam = url.searchParams.get('issuer');
    const issuer = issuerFromParam || issuerFromLabel || '';

    let fullAccountName = accountName;
    if (issuer && !accountName.startsWith(issuer)) {
      fullAccountName = issuer + ':' + accountName;
    }

    return {
      accountName: fullAccountName,
      secret,
    };
  } catch {
    return null;
  }
}

// Safe prompt wrapper with forgot passphrase flow
async function safePrompt(promptConfig) {
  try {
    return await inquirer.prompt(promptConfig);
  } catch (err) {
    if (err.name === 'ExitPromptError') {
      console.log('\n' + chalk.red('Anon, thou hast fled ere task was done. Farewell till next we meet.'));
      process.exit(0);
    }
    throw err;
  }
}

async function forgotPassphraseFlow() {
  const { wantRecover } = await safePrompt({
    type: 'confirm',
    name: 'wantRecover',
    message: 'Forgot your passphrase? Would you like to try recovering it using your security question?',
    default: false,
  });

  if (!wantRecover) {
    console.log(chalk.red('Passphrase is required to continue. Exiting.'));
    process.exit(1);
  }

  const { answer } = await safePrompt({
    type: 'input',
    name: 'answer',
    message: config.securityQuestion,
  });

  if (hashAnswer(answer) === config.securityAnswerHash) {
    console.log(chalk.green('Correct answer! You may now set a new passphrase.\n'));

const { newPassphrase1 } = await safePrompt({
  type: 'password',
  name: 'newPassphrase1',
  message: 'Enter your new encryption passphrase:',
  mask: '*',
  validate: input => input.length >= 6 || 'Passphrase must be at least 6 characters',
});

const { newPassphrase2 } = await safePrompt({
  type: 'password',
  name: 'newPassphrase2',
  message: 'Confirm new passphrase:',
  mask: '*',
  validate: input => input === newPassphrase1 || 'Passphrases do not match',
});
;

passphrase = newPassphrase1;
config.hashedPassphrase = hashPassphrase(passphrase);
await saveConfig();
console.log(chalk.green('\nPassphrase updated! You can now continue.\n'));


  } else {
    console.log(chalk.red('Incorrect answer. Cannot recover passphrase.'));
    process.exit(1);
  }
}


async function promptPassphrase() {
  while (true) {
  const { inputPassphrase } = await safePrompt({
    type: 'password',
    name: 'inputPassphrase',
    message: 'Enter your encryption passphrase:',
    mask: '*',
  });

  if (hashPassphrase(inputPassphrase) === config.hashedPassphrase) {
    passphrase = inputPassphrase;
    try {
      await loadAccounts();
      return true; // success
    } catch {
      console.log(chalk.red('Failed to decrypt accounts. Check your passphrase.\n'));
    }
  } else {
    console.log(chalk.red('Incorrect passphrase. Please try again.\n'));
    }
  }
}





async function importAccounts() {
  const { filePath } = await safePrompt({
    type: 'input',
    name: 'filePath',
    message: 'Path to import file from (JSON, TXT, or otpauth lines):',
    default: './import.txt',
  });
  try {
    const data = await fs.readFile(filePath, 'utf-8');

    let imported = [];
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) throw new Error('Not an array');
      imported = parsed;
    } catch {
      const lines = data.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const otpauthAccount = parseOtpauth(trimmed);
        if (otpauthAccount) {
          imported.push(otpauthAccount);
          continue;
        }

        const parts = trimmed.split(',');
        if (parts.length !== 2) {
          console.log(chalk.yellow(`Skipping invalid line: ${line}`));
          continue;
        }
        const [accountName, secret] = parts.map((p) => p.trim());
        if (!accountName || !secret) {
          console.log(chalk.yellow(`Skipping incomplete line: ${line}`));
          continue;
        }
        imported.push({ accountName, secret });
      }
    }

    accounts = [...accounts, ...imported];
    await saveAccounts();
    console.log(chalk.green(`✅ Imported ${imported.length} accounts from ${filePath}`));
  } catch (err) {
    console.log(chalk.red('Error reading or parsing the file:'), err.message);
  }
}

async function exportAccounts() {
  const { filePath } = await safePrompt({
    type: 'input',
    name: 'filePath',
    message: 'Path to export JSON file to:',
    default: './export.json',
  });
  try {
    await fs.writeFile(filePath, JSON.stringify(accounts, null, 2));
    console.log(chalk.green(`✅ Exported ${accounts.length} accounts to ${filePath}`));
  } catch (err) {
    console.log(chalk.red('Error writing to file:'), err.message);
  }
}

async function addAccount() {
  const { accountName, secret } = await safePrompt([
    {
      name: 'accountName',
      message: 'Account Name:',
      validate: (input) => input ? true : 'Please enter an account name',
    },
    {
      name: 'secret',
      message: 'Secret (Base32):',
      validate: (input) => /^[A-Z2-7]+=*$/.test(input.toUpperCase()) ? true : 'Invalid Base32 secret',
      filter: (input) => input.toUpperCase(),
    },
  ]);
  accounts.push({ accountName, secret });
  await saveAccounts();
  console.log(chalk.green(`\n✅ Account "${accountName}" added!\n`));
}

function secondsUntilNextPeriod() {
  const period = 30;
  const now = Math.floor(Date.now() / 1000);
  return period - (now % period);
}

async function showCodeWithCountdown(account) {
  let currentCode = null;

  console.log(chalk.cyan(`\n🔐 TOTP for ${chalk.magenta(account.accountName)}\n`));
  console.log(chalk.gray('Press ENTER to return to menu, or press "z" to copy code.\n'));

  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function cleanup() {
      clearInterval(interval);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      resolve();
    }

    async function onData(key) {
      if (key === '\r' || key === '\n') {
        cleanup();
      } else if (key === 'z' || key === 'Z') {
        if (currentCode) {
          try {
            await clipboardy.write(currentCode);
            console.log(chalk.green('\n✅ Code copied to clipboard!\n'));
          } catch {
            console.log(chalk.red('\n❌ Failed to copy code to clipboard.\n'));
          }
        }
      } else if (key === '\u0003') {
        cleanup();
        process.exit();
      }
    }

    process.stdin.on('data', onData);

    function createProgressBar(secondsLeft, totalSeconds) {
      const barLength = 30;
      const filledLength = Math.floor(((totalSeconds - secondsLeft) / totalSeconds) * barLength);
      const emptyLength = barLength - filledLength;
      return '[' + '█'.repeat(filledLength) + ' '.repeat(emptyLength) + ']';
    }

    const totalSeconds = 30;

    updateDisplay();

    const interval = setInterval(updateDisplay, 1000);

    function updateDisplay() {
      const secondsLeft = totalSeconds - (Math.floor(Date.now() / 1000) % totalSeconds);

      console.clear();
      printHeader();
      console.log(chalk.cyan(`\n🔐 TOTP for ${chalk.magenta(account.accountName)}\n`));
      try {
        currentCode = authenticator.generate(account.secret);
        const progressBar = createProgressBar(secondsLeft, totalSeconds);
        console.log(chalk.greenBright(`Code: ${currentCode}`));
        console.log(chalk.gray(`Expires in: ${secondsLeft}s ${progressBar}`));
      } catch {
        console.log(chalk.red('❌ Invalid secret for this account'));
        currentCode = null;
      }
      console.log(chalk.gray('\nPress ENTER to return to menu, or press "z" to copy code.'));
    }
  });
}

async function deleteAccount() {
  if (accounts.length === 0) {
    console.log(chalk.yellow('\n⚠️ No accounts to delete.\n'));
    await safePrompt({ type: 'input', name: 'pause', message: 'Press Enter to continue...' });
    return;
  }

  const { accountToDelete } = await safePrompt({
    type: 'list',
    name: 'accountToDelete',
    message: 'Select an account to delete:',
    choices: accounts.map(acc => acc.accountName),
    pageSize: 10,
  });

  const { confirmDelete } = await safePrompt({
    type: 'confirm',
    name: 'confirmDelete',
    message: `Are you sure you want to delete "${accountToDelete}"?`,
    default: false,
  });

  if (confirmDelete) {
    accounts = accounts.filter(acc => acc.accountName !== accountToDelete);
    await saveAccounts();
    console.log(chalk.green(`✅ Account "${accountToDelete}" deleted!\n`));
  } else {
    console.log(chalk.gray('Deletion cancelled.\n'));
  }

  await safePrompt({ type: 'input', name: 'pause', message: 'Press Enter to continue...' });
}

async function listCodes() {
  if (accounts.length === 0) {
    console.log(chalk.yellow('\n⚠️ No accounts added yet.\n'));
    await safePrompt({ type: 'input', name: 'pause', message: 'Press Enter to return to the menu...' });
    return;
  }

  const { chosenAccount } = await safePrompt({
    type: 'list',
    name: 'chosenAccount',
    message: 'Select an account to view its current TOTP code:',
    choices: accounts.map(acc => acc.accountName),
    pageSize: 10,
  });

  const account = accounts.find(acc => acc.accountName === chosenAccount);
  if (!account) {
    console.log(chalk.red('Account not found!'));
    await safePrompt({ type: 'input', name: 'pause', message: 'Press Enter to continue...' });
    return;
  }

  await showCodeWithCountdown(account);
}

async function mainMenu() {
  await loadConfig();

if (!config.passphraseSet) {
  await setupPassphraseAndSecurity();
  await loadAccounts(); // load accounts after setting passphrase
} else {
  while (true) {
    const { wantRecover } = await safePrompt({
      type: 'confirm',
      name: 'wantRecover',
      message: 'Forgot your passphrase? Would you like to recover it?',
      default: false,
    });

    if (wantRecover) {
      await forgotPassphraseFlow();
      try {
        await loadAccounts();
        break; // success
      } catch {
        console.log(chalk.red('Failed to load accounts after passphrase reset. Exiting.'));
        process.exit(1);
      }
    } else {
      await promptPassphrase(); // this internally retries until success
      break; // passphrase correct, exit loop
    }
  }
}

  while (true) {
    printHeader();
    const { action } = await safePrompt({
      type: 'list',
      name: 'action',
      message: 'Choose an action',
      choices: [
        'Add Account',
        'List Codes',
        'Delete Account',
        'Import Accounts from JSON or TXT',
        'Export Accounts to JSON',
        'Exit',
      ],
      pageSize: 10,
    });

    switch (action) {
      case 'Add Account':
        await addAccount();
        break;
      case 'List Codes':
        await listCodes();
        break;
      case 'Import Accounts from JSON or TXT':
        await importAccounts();
        break;
      case 'Delete Account':
        await deleteAccount();
        break;
      case 'Export Accounts to JSON':
        await exportAccounts();
        break;
      case 'Exit':
        console.log(chalk.blue('👋 Goodbye!'));
        process.exit(0);
    }
  }
}


mainMenu();
