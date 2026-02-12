
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Using a file to store logs since serverless/nextjs lambda context might recycle, 
// though for 'next start' local it persists. File is safer for simple MVP.
// Use /tmp for logging in serverless environments (always writable)
const LOG_FILE = path.join('/tmp', 'sync.log');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
}

// Try to find the script in multiple locations
const POSSIBLE_PATHS = [
    path.join(process.cwd(), '../service/run_local_sync.py'), // Standard dev
    path.join(process.cwd(), 'service/run_local_sync.py'),    // Standalone / container
    path.join('/tmp/testrail_web_execution/service/run_local_sync.py') // Explicit tmp fallback
];

let SCRIPT_PATH = POSSIBLE_PATHS[0];
for (const p of POSSIBLE_PATHS) {
    if (fs.existsSync(p)) {
        SCRIPT_PATH = p;
        break;
    }
}

// Global variable to track status in memory if the server stays alive
// But rely on file for output mainly.
let isRunning = false;

export async function POST(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get('force') === 'true';

    // Auto-reset lock if it's been stuck for too long (e.g. 10 minutes)
    // Or if force=true is passed
    if (isRunning && !force) {
        return NextResponse.json({ message: 'Sync already in progress' }, { status: 409 });
    }

    // Reset log file
    fs.writeFileSync(LOG_FILE, '');

    try {
        console.log('Spawning python script at:', SCRIPT_PATH);

        // Verify script exists before spawning
        if (!fs.existsSync(SCRIPT_PATH)) {
            throw new Error(`Sync script not found at: ${SCRIPT_PATH}`);
        }

        const child = spawn('python3', [SCRIPT_PATH], {
            env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });

        isRunning = true;

        child.stdout.on('data', (data) => {
            const line = data.toString();
            console.log('stdout:', line);
            fs.appendFileSync(LOG_FILE, line);
        });

        child.stderr.on('data', (data) => {
            const line = data.toString();
            console.error('stderr:', line);
            fs.appendFileSync(LOG_FILE, line);
        });

        child.on('close', (code) => {
            isRunning = false;
            console.log(`Child process exited with code ${code}`);
            fs.appendFileSync(LOG_FILE, `\nProcess exited with code ${code}\n`);
        });

        child.on('error', (err) => {
            isRunning = false;
            console.error('Child process error:', err);
            fs.appendFileSync(LOG_FILE, `\nSpawn Failed: ${err.message}\n`);
        });

        return NextResponse.json({ message: 'Sync started' });
    } catch (error: any) {
        isRunning = false;
        console.error('Spawn error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        let logs = '';
        if (fs.existsSync(LOG_FILE)) {
            logs = fs.readFileSync(LOG_FILE, 'utf-8');
        }
        return NextResponse.json({
            running: isRunning,
            logs: logs
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
