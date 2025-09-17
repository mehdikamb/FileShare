const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setupDatabase() {
    console.log(colorize('\nFileShare Database Setup', 'cyan'));
    console.log(colorize('=====================================', 'cyan'));

    console.log('\nSupported databases:');
    console.log('1. SQLite (default, no setup required)');
    console.log('2. MySQL');
    console.log('3. PostgreSQL');
    console.log('4. MongoDB');

    const choice = await question('\nSelect database type (1-4) [1]: ');

    let dbType, template, packages = [];

    switch (choice.trim() || '1') {
        case '1':
            dbType = 'sqlite';
            template = 'sqlite.env';
            packages = ['sqlite3'];
            break;
        case '2':
            dbType = 'mysql';
            template = 'mysql.env';
            packages = ['mysql2'];
            break;
        case '3':
            dbType = 'postgresql';
            template = 'postgresql.env';
            packages = ['pg'];
            break;
        case '4':
            dbType = 'mongodb';
            template = 'mongodb.env';
            packages = ['mongoose'];
            break;
        default:
            console.log(colorize('Invalid choice, defaulting to SQLite', 'yellow'));
            dbType = 'sqlite';
            template = 'sqlite.env';
            packages = ['sqlite3'];
    }

    console.log(colorize(`\n✅ Selected: ${dbType.toUpperCase()}`, 'green'));

    if (packages.length > 0) {
        console.log(colorize('\n📦 Installing required packages...', 'yellow'));

        const additionalPackages = ['bcrypt', 'dotenv'];
        const allPackages = [...packages, ...additionalPackages];

        try {
            execSync(`npm install ${allPackages.join(' ')}`, { stdio: 'inherit' });
            console.log(colorize('✅ Packages installed successfully!', 'green'));
        } catch (error) {
            console.log(colorize('❌ Error installing packages. Please run manually:', 'red'));
            console.log(`npm install ${allPackages.join(' ')}`);
        }
    }

    const templatePath = path.join(__dirname, 'templates', template);
    const envPath = path.join(__dirname, '.env');

    if (fs.existsSync(templatePath)) {
        await fs.copy(templatePath, envPath);
        console.log(colorize(`\n✅ Environment file created from ${template}`, 'green'));
    } else {
        console.log(colorize(`\n❌ Template ${template} not found`, 'red'));
        return;
    }

    if (dbType !== 'sqlite') {
        console.log(colorize('\n🔧 Database Configuration', 'blue'));

        const host = await question(`Database host [localhost]: `) || 'localhost';
        const port = await question(`Database port [${getDefaultPort(dbType)}]: `) || getDefaultPort(dbType);
        const user = await question(`Database user [${getDefaultUser(dbType)}]: `) || getDefaultUser(dbType);
        const password = await question(`Database password: `);
        const database = await question(`Database name [fileshare]: `) || 'fileshare';

        let envContent = await fs.readFile(envPath, 'utf8');
        envContent = envContent.replace(/DB_HOST=.*/, `DB_HOST=${host}`);
        envContent = envContent.replace(/DB_PORT=.*/, `DB_PORT=${port}`);
        envContent = envContent.replace(/DB_USER=.*/, `DB_USER=${user}`);
        envContent = envContent.replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${password}`);
        envContent = envContent.replace(/DB_NAME=.*/, `DB_NAME=${database}`);

        await fs.writeFile(envPath, envContent);
        console.log(colorize('✅ Configuration updated!', 'green'));
    }

    const dirs = ['uploads', 'data'];
    for (const dir of dirs) {
        await fs.ensureDir(path.join(__dirname, dir));
    }
    console.log(colorize('\n✅ Created necessary directories', 'green'));

    const sessionSecret = generateRandomSecret();
    let envContent = await fs.readFile(envPath, 'utf8');
    envContent = envContent.replace(/SESSION_SECRET=.*/, `SESSION_SECRET=${sessionSecret}`);
    await fs.writeFile(envPath, envContent);

    console.log(colorize('\n🎉 Setup completed successfully!', 'green'));
    console.log(colorize('\nNext steps:', 'yellow'));

    if (dbType !== 'sqlite') {
        console.log(`1. Make sure your ${dbType.toUpperCase()} server is running`);
        console.log(`2. Create the database "${database || 'fileshare'}" if it doesn't exist`);
    }

    console.log('3. Run: npm start');
    console.log('4. Open http://localhost:3000 in your browser');

    if (dbType !== 'sqlite') {
        console.log(colorize('\n📋 Database Setup Commands:', 'blue'));
        printDatabaseCommands(dbType, database || 'fileshare', user, password);
    }
}

function getDefaultPort(dbType) {
    const ports = {
        mysql: '3306',
        postgresql: '5432',
        mongodb: '27017'
    };
    return ports[dbType] || '3306';
}

function getDefaultUser(dbType) {
    const users = {
        mysql: 'root',
        postgresql: 'postgres',
        mongodb: ''
    };
    return users[dbType] || 'root';
}

function generateRandomSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function printDatabaseCommands(dbType, database, user, password) {
    switch (dbType) {
        case 'mysql':
            console.log('\nMySQL Commands:');
            console.log(`mysql -u ${user} -p`);
            console.log(`CREATE DATABASE ${database};`);
            console.log(`USE ${database};`);
            break;

        case 'postgresql':
            console.log('\nPostgreSQL Commands:');
            console.log(`psql -U ${user}`);
            console.log(`CREATE DATABASE ${database};`);
            console.log(`\\c ${database}`);
            break;

        case 'mongodb':
            console.log('\nMongoDB Commands:');
            console.log('mongo');
            console.log(`use ${database}`);
            break;
    }
}

async function main() {
    try {
        await setupDatabase();
    } catch (error) {
        console.log(colorize(`\n❌ Setup failed: ${error.message}`, 'red'));
    } finally {
        rl.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { setupDatabase };