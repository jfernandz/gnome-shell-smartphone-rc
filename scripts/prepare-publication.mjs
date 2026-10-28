#!/usr/bin/env node
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [tag, destination, ...extra] = process.argv.slice(2);
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '') || extra.length) {
    console.error('Usage: node scripts/prepare-publication.mjs vX.Y.Z [new-output-directory]');
    process.exit(1);
}
const output = resolve(destination ?? join(root, 'dist', `publication-${tag}`));
const git = (...args) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'}).trim();
const commit = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
if (existsSync(output)) throw new Error(`Output already exists; choose a new directory: ${output}`);
const temporary = mkdtempSync(join(tmpdir(), 'smartphone-rc-publication-'));
const source = join(temporary, 'source');
const checks = [];
let createdOutput = false;
function json(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
function run(label, command, args, options = {}) {
    console.log(label);
    const log = join(output, 'logs', `${label}.txt`);
    const descriptor = openSync(log, 'w', 0o600);
    let result;
    try {
        result = spawnSync(command, args, {cwd: source, timeout: 180_000, ...options, stdio: ['ignore', descriptor, descriptor]});
    } finally {
        closeSync(descriptor);
    }
    checks.push({name: label, passed: result.status === 0 && !result.error});
    if (result.status !== 0 || result.error)
        throw new Error(`${label} failed (${result.error?.message ?? result.status}); see ${log}`);
}
try {
    mkdirSync(source);
    execFileSync('git', ['-C', root, 'archive', '--format=tar', `--output=${join(temporary, 'source.tar')}`, commit]);
    execFileSync('tar', ['-xf', join(temporary, 'source.tar'), '-C', source]);
    const metadata = json(join(source, 'metadata.json'));
    const pkg = json(join(source, 'package.json'));
    const version = tag.slice(1);
    if (metadata['version-name'] !== version || pkg.version !== version)
        throw new Error('Tag, metadata.json and package.json versions must match.');
    for (const file of ['tests/cookie-browser.mjs', 'tests/browser-accessibility.mjs'])
        if (!existsSync(join(source, file))) throw new Error(`Tag lacks screenshot harness: ${file}`);
    mkdirSync(dirname(output), {recursive: true});
    mkdirSync(output, {mode: 0o700});
    createdOutput = true;
    mkdirSync(join(output, 'logs'));
    writeFileSync(join(output, 'INCOMPLETE.txt'), 'Preparation has not completed. Do not use this directory as release evidence.\n');
    run('automated-tests', process.execPath, ['--test', ...readdirSync(join(source, 'tests')).filter(name => name.endsWith('.test.js')).sort().map(name => `tests/${name}`)]);
    run('package', 'bash', ['scripts/package.sh', output]);
    const zipName = `smartphone-rc-${version}.zip`;
    const zip = join(output, zipName);
    run('zip-integrity', 'unzip', ['-t', zip]);
    const manifest = json(join(source, 'resources.json'));
    const expected = [...new Set([...manifest.runtime, ...Object.values(manifest.web).map(asset => asset.file)])].sort();
    const packed = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'}).trim().split('\n').filter(name => !name.endsWith('/')).sort();
    if (JSON.stringify(packed) !== JSON.stringify(expected)) throw new Error('ZIP file list differs from the tagged runtime manifest.');
    for (const file of expected) {
        const data = execFileSync('unzip', ['-p', zip, file], {maxBuffer: 8 * 1024 * 1024});
        if (sha256(data) !== sha256(readFileSync(join(source, file)))) throw new Error(`ZIP differs from tag: ${file}`);
    }
    checks.push({name: 'zip-matches-tag-and-manifest', passed: true, files: expected.length});
    writeFileSync(join(output, 'runtime-files.txt'), expected.join('\n') + '\n');
    const screenshots = join(output, 'screenshots');
    run('browser-accessibility', process.execPath, ['tests/cookie-browser.mjs', '--trusted', '--helper', '--accessibility'], {
        env: {...process.env, SMARTPHONE_RC_ACCESSIBILITY_OUTPUT: screenshots},
    });
    // These are candidates from the tag's own browser harness, never a live desktop.
    const candidates = [
        ['controls-360x800-16-all.png', '01-mobile-controls.png'],
        ['touchpad-844x390-16.png', '02-landscape-touchpad.png'],
    ];
    for (const [original, selected] of candidates) {
        if (!existsSync(join(screenshots, original))) throw new Error(`Tag does not provide the expected publication candidate: ${original}`);
        copyFileSync(join(screenshots, original), join(output, selected));
    }
    const icon = 'smartphone-rc-icon.png';
    run('icon', 'magick', ['-background', 'none', '-density', '2304', 'icons/remote-touchpad-symbolic.svg', '-resize', '128x128', '-strip', join(output, icon)]);
    const changelog = readFileSync(join(source, 'CHANGELOG.md'), 'utf8');
    const section = changelog.split(/^## /m).find(part => part.startsWith(`${version} `) || part.startsWith(`${version}\n`));
    if (!section) throw new Error(`No changelog section for ${version}`);
    writeFileSync(join(output, 'release-notes.md'), '## ' + section.trim() + '\n');
    const readme = readFileSync(join(source, 'README.md'), 'utf8');
    const features = readme.match(/## Features\n([\s\S]*?)(?=\n## )/)?.[1]?.trim();
    if (!features) throw new Error('No Features section in tagged README.');
    writeFileSync(join(output, 'listing-draft.md'), `# Listing draft — ${tag}\n\nUse a smartphone browser as a touchpad and keyboard for an unlocked GNOME desktop over the local network. No mobile app is required.\n\n${features}\n\nRequires GNOME Shell ${metadata['shell-version'].join(', ')}. Chrome on Android is the initial target; iOS Safari is unvalidated. Pairing uses local HTTPS/WSS and explicit desktop approval.\n\nDraft only: review wording and device compatibility before updating the listing.\n`);
    for (const name of ['README.md', 'SECURITY.md', 'TESTING.md', 'SHEXLI.md'])
        copyFileSync(join(source, name), join(output, name));
    const evidence = {
        tag, commit, generatedAt: new Date().toISOString(),
        generatorCommit: git('rev-parse', 'HEAD'),
        generatorSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
        node: process.version, checks, zip: {file: zipName, sha256: sha256(readFileSync(zip)), files: expected.length},
        screenshots: 'Synthetic Chromium captures from the tagged source and real loopback D-Bus helper; synthetic audio and approval. No physical phone, GNOME desktop input or real audio acceptance.',
        pending: ['ESLint for this tag', 'Pinned static analyzer and manual source review', 'Isolated GNOME Shell/package acceptance', 'Physical phone and certificate first-use acceptance', 'Maintainer review and screenshot selection', 'Submission and EGO approval'],
    };
    writeFileSync(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(join(output, 'REVIEW.md'), `# ${tag} publication preparation\n\nTag commit: \`${commit}\`. Generated ${evidence.generatedAt}.\n\nLocal preparation only. No release, listing update, reviewer message or submission has been sent. This is an automated evidence report, not a manual code review or EGO approval.\n\n## Artifact\n\n- [Installable ZIP](${zipName})\n- SHA-256: \`${evidence.zip.sha256}\`\n- All ${expected.length} packaged files match the tagged source and runtime manifest byte for byte.\n\n## Completed checks\n\n${checks.map(check => `- ${check.name}: passed`).join('\n')}\n\nSee [machine-readable evidence](evidence.json) and logs/. ESLint, native Shell and static analysis were not run by this script. Copied source documentation records historical evidence, not additional checks performed here.\n\n## Screenshot candidates\n\n1. [Portrait controls](01-mobile-controls.png): connected, editor closed, direct controls visible.\n2. [Landscape touchpad](02-landscape-touchpad.png): card closed, maximum gesture area.\n\n${evidence.screenshots}\nCaptures show only the web page; no address bar, LAN address or pairing link. All harness captures, including test-only editor text and enlarged fonts, remain in screenshots/; the two numbered files are the listing candidates.\n\n[128×128 transparent icon](${icon}), [release notes](release-notes.md), [listing draft](listing-draft.md). Review candidates before uploading; dimensions are a preparation choice, not a claim about current EGO upload requirements.\n\n## Pending\n\n${evidence.pending.map(item => `- [ ] ${item}`).join('\n')}\n`);
    const artifacts = readdirSync(output).filter(name => name !== 'INCOMPLETE.txt' && !['logs', 'screenshots'].includes(name));
    writeFileSync(join(output, 'SHA256SUMS'), artifacts.sort().map(name => `${sha256(readFileSync(join(output, name)))}  ${name}`).join('\n') + '\n');
    rmSync(join(output, 'INCOMPLETE.txt'));
    console.log(`Publication preparation ready: ${output}`);
} catch (error) {
    if (createdOutput) console.error(`Incomplete output retained for inspection: ${output}`);
    throw error;
} finally {
    rmSync(temporary, {recursive: true, force: true});
}
