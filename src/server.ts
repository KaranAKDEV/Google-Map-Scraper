/**
 * server.ts — Express Backend for Google Maps Scraper Web UI.
 *
 * Provides REST & Server-Sent Events (SSE) API to:
 * - Start / stop scraping with custom configurations
 * - Stream real-time logs & crawl progress
 * - Query scraped places & dataset analytics
 * - Trigger and download CSV/JSON exports
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, exec, type ChildProcess } from 'node:child_process';
import { exportData } from './export.js';
import { InputSchema, type PlaceData } from './types.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public'
const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

// ─── Scraper State & SSE Management ──────────────────────────────────────────

interface ScraperState {
    isScraping: boolean;
    process: ChildProcess | null;
    startTime: number | null;
    currentConfig: Record<string, unknown> | null;
    logs: string[];
    placesCount: number;
}

const state: ScraperState = {
    isScraping: false,
    process: null,
    startTime: null,
    currentConfig: null,
    logs: [],
    placesCount: 0,
};

const sseClients = new Set<express.Response>();

function broadcast(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch {
            sseClients.delete(client);
        }
    }
}

function appendLog(rawMessage: string) {
    // Strip ANSI color codes for clean web display
    const clean = rawMessage.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
    if (!clean) return;

    // Keep last 400 lines
    if (state.logs.length > 400) {
        state.logs.shift();
    }
    state.logs.push(clean);

    broadcast('log', { message: clean, timestamp: new Date().toISOString() });
}

async function getDatasetCount(): Promise<number> {
    try {
        const datasetDir = path.resolve(process.cwd(), 'storage/datasets/default');
        const files = await fs.readdir(datasetDir);
        return files.filter((f) => f.endsWith('.json')).length;
    } catch {
        return 0;
    }
}

// ─── API Routes ──────────────────────────────────────────────────────────────

// 1. SSE Stream for real-time logs & progress
app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseClients.add(res);

    // Initial state push
    res.write(`event: status\ndata: ${JSON.stringify({
        isScraping: state.isScraping,
        placesCount: state.placesCount,
        startTime: state.startTime,
        config: state.currentConfig,
    })}\n\n`);

    // Heartbeat every 15s to keep connection alive
    const interval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
        clearInterval(interval);
        sseClients.delete(res);
    });
});

// 2. Status check
app.get('/api/status', async (_req, res) => {
    const count = await getDatasetCount();
    state.placesCount = count;
    res.json({
        isScraping: state.isScraping,
        placesCount: count,
        startTime: state.startTime,
        logs: state.logs.slice(-50),
        config: state.currentConfig,
    });
});

// 3. Start Scraping
app.post('/api/scrape', async (req, res) => {
    if (state.isScraping) {
        res.status(409).json({ success: false, message: 'A scrape job is already in progress.' });
        return;
    }

    // Validate configuration
    const parsed = InputSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: 'Invalid input configuration',
            errors: parsed.error.flatten(),
        });
        return;
    }

    const config = parsed.data;

    // Write input.json so standalone scraper picks it up
    const inputPath = path.resolve(process.cwd(), 'input.json');
    try {
        await fs.writeFile(inputPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to write input.json', error: String(err) });
        return;
    }

    state.isScraping = true;
    state.startTime = Date.now();
    state.currentConfig = config;
    state.logs = [];
    state.placesCount = await getDatasetCount();

    appendLog(`🚀 Initializing Google Maps Scraper...`);
    appendLog(`🔍 Search Queries: ${config.searchQueries.join(', ') || 'None'}`);
    appendLog(`🎯 Max Places per query: ${config.maxPlacesPerQuery} | Max Concurrency: ${config.maxConcurrency}`);
    appendLog(`✉️ Email extraction: ${config.deeperCrawl ? 'Enabled' : 'Disabled'}`);

    broadcast('status', {
        isScraping: true,
        placesCount: state.placesCount,
        startTime: state.startTime,
        config,
    });

    // Spawn scraper process
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'cmd.exe' : 'npx';
    const args = isWindows ? ['/c', 'npx', 'tsx', 'src/main.ts'] : ['tsx', 'src/main.ts'];

    const child = spawn(cmd, args, {
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    state.process = child;

    // Monitor file counts periodically while scraping
    const countPoll = setInterval(async () => {
        if (!state.isScraping) {
            clearInterval(countPoll);
            return;
        }
        const currentCount = await getDatasetCount();
        if (currentCount !== state.placesCount) {
            state.placesCount = currentCount;
            broadcast('progress', { placesCount: currentCount });
        }
    }, 2000);

    child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.trim()) appendLog(line);
        }
    });

    child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.trim()) appendLog(`[WARN] ${line}`);
        }
    });

    child.on('close', async (code) => {
        clearInterval(countPoll);
        state.isScraping = false;
        state.process = null;

        const finalCount = await getDatasetCount();
        state.placesCount = finalCount;

        appendLog(`🏁 Scraper finished with code ${code}. Generating export files...`);

        // Automatically trigger data export
        try {
            const exp = await exportData();
            appendLog(`✅ Export completed: ${exp.count} records saved to results.json and results.csv`);
            broadcast('finished', {
                exitCode: code,
                count: exp.count,
                records: exp.records.slice(0, 50), // Send first 50 for quick display
            });
        } catch (err) {
            appendLog(`❌ Export error: ${String(err)}`);
            broadcast('finished', { exitCode: code, count: finalCount, error: String(err) });
        }

        broadcast('status', {
            isScraping: false,
            placesCount: finalCount,
            startTime: null,
            config: null,
        });
    });

    child.on('error', (err) => {
        clearInterval(countPoll);
        state.isScraping = false;
        state.process = null;
        appendLog(`❌ Scraper execution failed: ${err.message}`);
        broadcast('error', { message: err.message });
        broadcast('status', { isScraping: false });
    });

    res.json({
        success: true,
        message: 'Scraping started successfully',
        config,
    });
});

// 4. Stop Scraping
app.post('/api/stop', async (_req, res) => {
    if (!state.isScraping || !state.process) {
        res.json({ success: true, message: 'Scraper is not running.' });
        return;
    }

    appendLog('🛑 Stopping scraper upon user request...');

    const pid = state.process.pid;
    if (pid) {
        if (process.platform === 'win32') {
            exec(`taskkill /pid ${pid} /T /F`, (err) => {
                if (err) appendLog(`[Notice] taskkill: ${err.message}`);
            });
        } else {
            state.process.kill('SIGTERM');
        }
    }

    state.isScraping = false;
    state.process = null;
    broadcast('status', { isScraping: false });
    res.json({ success: true, message: 'Scraper stopped.' });
});

// 5. Get Scraped Results & Detailed Statistics
app.get('/api/results', async (_req, res) => {
    try {
        const jsonPath = path.resolve(process.cwd(), 'results.json');
        let records: PlaceData[] = [];

        try {
            const content = await fs.readFile(jsonPath, 'utf-8');
            records = JSON.parse(content);
        } catch {
            // If results.json doesn't exist yet, try to export and load
            const exp = await exportData();
            records = exp.records;
        }

        // Compute rich summary metrics for dashboard
        let withEmail = 0;
        let withPhone = 0;
        let withWebsite = 0;
        let withRating = 0;
        let scoreSum = 0;
        const categoryMap: Record<string, number> = {};

        for (const p of records) {
            if (p.email && p.email.trim()) withEmail++;
            if (p.phone && p.phone.trim()) withPhone++;
            if (p.website && p.website.trim()) withWebsite++;
            if (typeof p.totalScore === 'number' && p.totalScore > 0) {
                withRating++;
                scoreSum += p.totalScore;
            }
            const cat = p.category || 'Uncategorized';
            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        }

        const avgScore = withRating > 0 ? (scoreSum / withRating).toFixed(1) : 'N/A';

        res.json({
            count: records.length,
            stats: {
                totalPlaces: records.length,
                withEmail,
                withPhone,
                withWebsite,
                withRating,
                avgScore,
                categories: categoryMap,
            },
            places: records,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load results', error: String(err) });
    }
});

// 6. Trigger Export
app.post('/api/export', async (_req, res) => {
    try {
        const exp = await exportData();
        res.json({
            success: true,
            count: exp.count,
            jsonPath: '/api/download/json',
            csvPath: '/api/download/csv',
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Export failed', error: String(err) });
    }
});

// 7. Download CSV
app.get('/api/download/csv', async (_req, res) => {
    const csvPath = path.resolve(process.cwd(), 'results.csv');
    try {
        await fs.access(csvPath);
        res.download(csvPath, `google-maps-leads-${Date.now()}.csv`);
    } catch {
        // Generate if not present
        await exportData();
        res.download(csvPath, `google-maps-leads-${Date.now()}.csv`);
    }
});

// 8. Download JSON
app.get('/api/download/json', async (_req, res) => {
    const jsonPath = path.resolve(process.cwd(), 'results.json');
    try {
        await fs.access(jsonPath);
        res.download(jsonPath, `google-maps-leads-${Date.now()}.json`);
    } catch {
        await exportData();
        res.download(jsonPath, `google-maps-leads-${Date.now()}.json`);
    }
});

// 9. Clear/Reset Entire Dataset
app.delete('/api/results', async (_req, res) => {
    if (state.isScraping) {
        res.status(409).json({ success: false, message: 'Cannot clear data while scraper is active.' });
        return;
    }

    try {
        const datasetDir = path.resolve(process.cwd(), 'storage/datasets/default');
        const files = await fs.readdir(datasetDir).catch(() => []);
        for (const file of files) {
            await fs.unlink(path.join(datasetDir, file)).catch(() => {});
        }

        const jsonPath = path.resolve(process.cwd(), 'results.json');
        const csvPath = path.resolve(process.cwd(), 'results.csv');
        await fs.unlink(jsonPath).catch(() => {});
        await fs.unlink(csvPath).catch(() => {});

        state.placesCount = 0;
        state.logs = [];

        broadcast('status', { isScraping: false, placesCount: 0 });
        res.json({ success: true, message: 'All results and dataset records deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to clear dataset', error: String(err) });
    }
});

// 10. Delete a Single Place Record by Index
app.delete('/api/results/:index', async (req, res) => {
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0) {
        res.status(400).json({ success: false, message: 'Invalid place index' });
        return;
    }

    try {
        const jsonPath = path.resolve(process.cwd(), 'results.json');
        const content = await fs.readFile(jsonPath, 'utf-8');
        const records: PlaceData[] = JSON.parse(content);

        if (idx >= records.length) {
            res.status(404).json({ success: false, message: 'Record not found' });
            return;
        }

        const deleted = records.splice(idx, 1)[0];
        await fs.writeFile(jsonPath, JSON.stringify(records, null, 2), 'utf-8');

        // Also update results.csv
        const csvPath = path.resolve(process.cwd(), 'results.csv');
        const headers = [
            'Title', 'Category', 'Address', 'Phone', 'Website', 'Email',
            'Rating', 'Reviews Count', 'Instagram', 'Facebook', 'LinkedIn',
            'WhatsApp', 'Plus Code', 'Latitude', 'Longitude', 'Google Maps URL',
        ];
        const escapeCsv = (val: unknown): string => {
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
        };
        const rows = records.map((r) => [
            escapeCsv(r.title), escapeCsv(r.category), escapeCsv(r.address),
            escapeCsv(r.phone), escapeCsv(r.website), escapeCsv(r.email),
            escapeCsv(r.totalScore), escapeCsv(r.reviewsCount),
            escapeCsv(r.socialProfiles?.instagram ?? ''),
            escapeCsv(r.socialProfiles?.facebook ?? ''),
            escapeCsv(r.socialProfiles?.linkedin ?? ''),
            escapeCsv(r.socialProfiles?.whatsapp ?? ''),
            escapeCsv(r.plusCode), escapeCsv(r.latitude), escapeCsv(r.longitude),
            escapeCsv(r.url),
        ]);
        await fs.writeFile(csvPath, [headers.join(','), ...rows.map((row) => row.join(','))].join('\n'), 'utf-8');

        state.placesCount = records.length;
        broadcast('progress', { placesCount: records.length });

        res.json({ success: true, message: `Deleted ${deleted.title}`, count: records.length });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete record', error: String(err) });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🌐 Google Maps Scraper Web UI is running!`);
    console.log(`👉 Open in your browser: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});
