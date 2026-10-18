/**
 * config.ts — Shared runtime configuration singleton.
 *
 * Set once during initialization from the validated Actor input, then
 * accessed by route handlers via getConfig().
 */

import type { Input } from './types.js';

let _config: Input | null = null;

export function setConfig(input: Input): void {
    _config = input;
}

export function getConfig(): Input {
    if (!_config) {
        throw new Error('Config not initialized. Call setConfig() first.');
    }
    return _config;
}
