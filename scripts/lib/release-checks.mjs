import {readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

// Only receipts from both successful matrix jobs for the archived commit may
// replace a local test run. The workflow supplies them from its own artifacts.
export function readReleaseChecks(directory, commit) {
    return ['22', '24'].map(major => {
        const folder = join(directory, `release-checks-node-${major}`);
        const receipt = JSON.parse(readFileSync(join(folder, 'evidence.json'), 'utf8'));
        if (receipt.commit !== commit || typeof receipt.node !== 'string' || receipt.node.split('.')[0] !== major ||
            receipt.checks?.lint !== true || receipt.checks?.automatedTests !== true)
            throw new Error(`Invalid or stale Node ${major} checks for ${commit}`);
        const logs = ['lint.txt', 'automated-tests.txt'].map(name => join(folder, name));
        for (const log of logs)
            if (!statSync(log).isFile()) throw new Error(`Missing release check log: ${log}`);
        return {major, receipt, logs};
    });
}
