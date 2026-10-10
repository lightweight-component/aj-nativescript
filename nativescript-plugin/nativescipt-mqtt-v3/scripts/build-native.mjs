import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const androidRoot = path.resolve(root, '../../android/nativescipt-mqtt-v3');
const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/c', 'gradlew.bat jar --console=plain'], { cwd: androidRoot, stdio: 'inherit' })
    : spawnSync('sh', ['./gradlew', 'jar', '--console=plain'], { cwd: androidRoot, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const target = path.join(root, 'platforms/android');
mkdirSync(target, { recursive: true });
const version = readFileSync(path.join(androidRoot, 'gradle.properties'), 'utf8')
    .match(/^version\s*=\s*([A-Za-z0-9._-]+)\s*$/m)?.[1];
if (!version) throw new Error('Missing or invalid version in android/gradle.properties.');
copyFileSync(path.join(androidRoot, `build/libs/aj-nativescript-mqtt-v3-${version}.jar`),
    path.join(target, 'aj-nativescript-mqtt-v3.jar'));
