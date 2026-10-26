#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
exec node --input-type=module - "$project_dir" "$@" <<'JS'
import {readdirSync, statSync, mkdirSync, writeFileSync, renameSync, symlinkSync, readlinkSync, unlinkSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const project = process.argv[2];
const args = process.argv.slice(3);
if (args.length > 1 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: bash scripts/prepare-zip-install.sh [zip-path]');
    console.log('Without a path, select the most recently modified ZIP under dist/ (including review/).');
    process.exit(args.length > 1 ? 1 : 0);
}
function archives(directory) {
    try {
        return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) return archives(path);
            return entry.isFile() && entry.name.endsWith('.zip') ? [path] : [];
        });
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}
try {
    const archivePath = args.length ? resolve(args[0]) : archives(join(project, 'dist'))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs || a.localeCompare(b))[0];
    if (!archivePath) throw Error('No ZIP found under dist/. Build one with bash scripts/package.sh first.');
    if (!statSync(archivePath).isFile()) throw Error('The selected ZIP must be a regular file.');
    const metadata = JSON.parse(execFileSync('unzip', ['-p', archivePath, 'metadata.json'], {encoding: 'utf8', maxBuffer: 65536}));
    if (metadata.uuid !== 'smartphone-rc@jfaparicio.github.io') throw Error('This ZIP belongs to a different extension.');
    const cache = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'smartphone-rc');
    mkdirSync(cache, {recursive: true, mode: 0o700});
    const alias = join(cache, 'zip-install-tool.js');
    const source = join(project, 'scripts/install-zip.js');
    try {
        if (readlinkSync(alias) !== source) { unlinkSync(alias); symlinkSync(source, alias); }
    } catch (error) {
        if (error.code === 'ENOENT') symlinkSync(source, alias);
        else throw error;
    }
    const selected = join(cache, 'selected-zip.json');
    const temporary = `${selected}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify({archivePath}), {mode: 0o600});
    renameSync(temporary, selected);
    console.log(`Selected ZIP: ${archivePath}`);
    console.log(`Version: ${metadata['version-name'] ?? metadata.version ?? 'unknown'}`);
    console.log('Paste this reusable command into Looking Glass:');
    console.log(`await (await import(${JSON.stringify(pathToFileURL(alias).href)})).installZip()`);
    console.log('For later ZIPs: rerun this script, then recall the SAME Looking Glass command with Up and Enter.');
    console.log('This selects a ZIP; it does not build or install anything yet.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
JS
