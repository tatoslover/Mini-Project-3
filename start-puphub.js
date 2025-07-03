#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🐕 Starting PupHub - Your Ultimate Dog Paradise!\n');

// Check if package.json exists
if (!fs.existsSync('package.json')) {
    console.log('❌ Error: package.json not found');
    console.log('Please run this script from the PupHub project directory\n');
    process.exit(1);
}

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    const install = spawn('npm', ['install'], { stdio: 'inherit' });

    install.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Dependencies installed successfully!\n');
            startServers();
        } else {
            console.log('❌ Failed to install dependencies');
            process.exit(1);
        }
    });
} else {
    startServers();
}

function startServers() {
    console.log('🚀 Starting PupHub servers...\n');

    // Start backend server
    console.log('🔧 Starting backend server on port 3000...');
    const backend = spawn('node', ['puphub-server.js'], {
        stdio: ['inherit', 'pipe', 'pipe']
    });

    backend.stdout.on('data', (data) => {
        process.stdout.write(`[BACKEND] ${data}`);
    });

    backend.stderr.on('data', (data) => {
        process.stderr.write(`[BACKEND] ${data}`);
    });

    // Wait a bit, then start frontend
    setTimeout(() => {
        console.log('\n🌐 Starting frontend server on port 8080...');

        // Try different methods to serve frontend
        const frontendCommands = [
            ['python', ['-m', 'http.server', '8080']],
            ['python3', ['-m', 'http.server', '8080']],
            ['npx', ['http-server', 'frontend', '-p', '8080', '-c-1']],
            ['node', ['-e', `
                const http = require('http');
                const fs = require('fs');
                const path = require('path');
                const server = http.createServer((req, res) => {
                    let filePath = path.join(__dirname, 'frontend', req.url === '/' ? 'index.html' : req.url);
                    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
                        filePath = path.join(__dirname, 'frontend', 'index.html');
                    }
                    const ext = path.extname(filePath);
                    const contentType = {
                        '.html': 'text/html',
                        '.js': 'text/javascript',
                        '.css': 'text/css',
                        '.json': 'application/json',
                        '.png': 'image/png',
                        '.jpg': 'image/jpg',
                        '.gif': 'image/gif',
                        '.svg': 'image/svg+xml',
                        '.wav': 'audio/wav',
                        '.mp4': 'video/mp4',
                        '.woff': 'application/font-woff',
                        '.ttf': 'application/font-ttf',
                        '.eot': 'application/vnd.ms-fontobject',
                        '.otf': 'application/font-otf',
                        '.wasm': 'application/wasm'
                    }[ext] || 'application/octet-stream';
                    try {
                        const content = fs.readFileSync(filePath);
                        res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
                        res.end(content, 'utf-8');
                    } catch (error) {
                        res.writeHead(404);
                        res.end('File not found');
                    }
                });
                server.listen(8080, () => console.log('Frontend server running on http://localhost:8080'));
            `]]
        ];

        let frontendStarted = false;

        function tryNextCommand(index = 0) {
            if (index >= frontendCommands.length || frontendStarted) {
                if (!frontendStarted) {
                    console.log('\n⚠️  Could not start frontend server automatically');
                    console.log('Please manually serve the frontend directory on port 8080');
                    console.log('Example: cd frontend && python -m http.server 8080\n');
                }
                return;
            }

            const [command, args] = frontendCommands[index];
            const frontend = spawn(command, args, {
                cwd: process.cwd(),
                stdio: ['inherit', 'pipe', 'pipe']
            });

            let hasOutput = false;

            frontend.stdout.on('data', (data) => {
                hasOutput = true;
                frontendStarted = true;
                process.stdout.write(`[FRONTEND] ${data}`);
            });

            frontend.stderr.on('data', (data) => {
                if (!frontendStarted) {
                    // Ignore stderr for failed attempts
                    return;
                }
                process.stderr.write(`[FRONTEND] ${data}`);
            });

            frontend.on('error', (error) => {
                if (!frontendStarted) {
                    // Try next command
                    setTimeout(() => tryNextCommand(index + 1), 100);
                }
            });

            frontend.on('close', (code) => {
                if (!frontendStarted && code !== 0) {
                    // Try next command
                    setTimeout(() => tryNextCommand(index + 1), 100);
                }
            });

            // Give it a moment to start
            setTimeout(() => {
                if (!hasOutput && !frontendStarted) {
                    frontend.kill();
                    tryNextCommand(index + 1);
                }
            }, 2000);
        }

        tryNextCommand();

    }, 3000);

    // Display startup information
    setTimeout(() => {
        console.log('\n🎉 PupHub is starting up!');
        console.log('\n📋 Available URLs:');
        console.log('   🎮 Control Center: http://localhost:3000');
        console.log('   🌐 Frontend App:   http://localhost:8080');
        console.log('   ❤️  API Health:    http://localhost:3000/api/health');
        console.log('   📚 API Docs:       http://localhost:3000/api');
        console.log('\n🐾 Ready to explore some adorable dogs!');
        console.log('\n💡 Tips:');
        console.log('   • Press Ctrl+C to stop both servers');
        console.log('   • Check the browser console for any errors');
        console.log('   • The frontend works even if the backend is down');
        console.log('\n🔍 Troubleshooting:');
        console.log('   • Backend not starting? Check if port 3000 is free');
        console.log('   • Frontend not loading? Try http://localhost:8080 manually');
        console.log('   • API errors? The app falls back to direct Dog API calls');
        console.log('\n');
    }, 5000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down PupHub servers...');
        backend.kill('SIGTERM');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down PupHub servers...');
        backend.kill('SIGTERM');
        process.exit(0);
    });

    backend.on('close', (code) => {
        if (code !== 0 && code !== null) {
            console.log(`\n❌ Backend server exited with code ${code}`);
            process.exit(1);
        }
    });
}
