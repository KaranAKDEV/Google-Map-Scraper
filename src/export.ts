import fs from 'node:fs/promises';
import path from 'node:path';
import type { PlaceData } from './types.js';

export async function exportData(): Promise<{ records: PlaceData[]; jsonPath: string; csvPath: string; count: number; csvContent: string }> {
    const datasetDir = path.resolve(process.cwd(), 'storage/datasets/default');

    try {
        await fs.access(datasetDir);
    } catch {
        console.error(`❌ Dataset directory not found at: ${datasetDir}`);
        console.log('Run the scraper first using `npm run start:dev` to generate data.');
        return { records: [], jsonPath: '', csvPath: '', count: 0, csvContent: '' };
    }

    const files = await fs.readdir(datasetDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
        console.log('⚠️ No JSON records found in storage/datasets/default.');
        return { records: [], jsonPath: '', csvPath: '', count: 0, csvContent: '' };
    }

    const records: PlaceData[] = [];

    for (const file of jsonFiles) {
        try {
            const content = await fs.readFile(path.join(datasetDir, file), 'utf-8');
            records.push(JSON.parse(content));
        } catch (err) {
            console.warn(`Could not read ${file}:`, err);
        }
    }

    console.log(`📦 Loaded ${records.length} records from local dataset.`);

    // 1. Export unified results.json
    const jsonPath = path.resolve(process.cwd(), 'results.json');
    await fs.writeFile(jsonPath, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`✅ Saved unified JSON: ${jsonPath}`);

    // 2. Export flattened results.csv for Excel / Google Sheets
    const csvPath = path.resolve(process.cwd(), 'results.csv');
    const headers = [
        'Title',
        'Category',
        'Address',
        'Phone',
        'Website',
        'Email',
        'Rating',
        'Reviews Count',
        'Instagram',
        'Facebook',
        'LinkedIn',
        'WhatsApp',
        'Plus Code',
        'Latitude',
        'Longitude',
        'Google Maps URL',
    ];

    const escapeCsv = (val: unknown): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = records.map((r) => [
        escapeCsv(r.title),
        escapeCsv(r.category),
        escapeCsv(r.address),
        escapeCsv(r.phone),
        escapeCsv(r.website),
        escapeCsv(r.email),
        escapeCsv(r.totalScore),
        escapeCsv(r.reviewsCount),
        escapeCsv(r.socialProfiles?.instagram ?? ''),
        escapeCsv(r.socialProfiles?.facebook ?? ''),
        escapeCsv(r.socialProfiles?.linkedin ?? ''),
        escapeCsv(r.socialProfiles?.whatsapp ?? ''),
        escapeCsv(r.plusCode),
        escapeCsv(r.latitude),
        escapeCsv(r.longitude),
        escapeCsv(r.url),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    await fs.writeFile(csvPath, csvContent, 'utf-8');
    console.log(`✅ Saved CSV (for Excel): ${csvPath}`);

    return { records, jsonPath, csvPath, count: records.length, csvContent };
}

// Run directly if invoked from CLI
const isDirectRun = process.argv[1] && (
    process.argv[1].replace(/\\/g, '/').endsWith('src/export.ts') ||
    process.argv[1].replace(/\\/g, '/').endsWith('dist/export.js')
);
if (isDirectRun) {
    exportData().catch(console.error);
}

