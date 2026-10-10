import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk)
    throw new Error('Set ANDROID_HOME to an SDK containing platform android-35.');
const classes = mkdtempSync(path.join(tmpdir(), 'ajaxjs-interop-'));
const source = path.join(root, 'android/nativescipt-common/aj-nativescript/src/main/java/com/ajaxjs/nativescript/android/crypto');
function run(cmd, args) {
    const result = spawnSync(cmd, args, { encoding: 'utf8' });
    if (result.error)
        throw result.error;
    if (result.status !== 0)
        throw new Error(result.stderr);
    return result.stdout;
}
run('javac', ['-cp', path.join(sdk, 'platforms/android-35/android.jar'), '-d', classes,
    ...['EncryptedBody', 'JsonBodyCipher', 'AesKeyStore'].map(name => path.join(source, `${name}.java`)),
    fileURLToPath(new URL('./Interop.java', import.meta.url))]);
function java(args) {
    return run('java', ['-cp', classes, 'com.ajaxjs.nativescript.android.crypto.Interop', ...args]);
}
if (process.argv[2] === '--generate') {
    const vectors = [16, 24, 32].map(size => {
        const [nonce, data] = java([String(size)]).trim().split(/\r?\n/);
        return { size, key: Buffer.alloc(size).toString('base64'), nonce, data };
    });
    writeFileSync(path.join(root, 'demo-app/src/common/aes-vectors.json'), JSON.stringify(vectors, null, 2) + '\n');
} else {
    const log = readFileSync(process.argv[2], 'utf8');
    const vectors = [...log.matchAll(/AES_INTEROP:(\{[^\r\n]+\})/g)].map(match => JSON.parse(match[1]));
    assert.deepEqual([...new Set(vectors.map(vector => vector.size))].sort(), [16, 24, 32]);
    for (const vector of vectors) {
        assert.equal(Buffer.from(vector.nonce, 'base64').length, 12);
        assert.deepEqual(JSON.parse(java([String(vector.size), vector.nonce, vector.data])), { message: '中文 🔐', count: 1 });
    }
    assert.match(log, /AES_SELF_CHECK:PASS/);
    assert.doesNotMatch(log, /AES_SELF_CHECK:FAIL/);
    console.log('iOS → Android production Cipher interoperability passed for AES-128/192/256.');
}
