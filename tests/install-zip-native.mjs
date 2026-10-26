import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, statSync, existsSync, symlinkSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';

if (process.env.SMARTPHONE_RC_ISOLATED_SHELL !== '1' || !process.argv[2] || !process.argv[3])
    throw Error('Use an explicitly isolated Shell bus file and pass a real extension ZIP; never run against the working desktop.');
const bus = readFileSync(process.argv[2], 'utf8');
const actualArchive = resolve(process.argv[3]);
const directory = mkdtempSync(join(tmpdir(), 'smartphone-rc-zip-native-'));
const output = join(directory, 'result.json');
symlinkSync(fileURLToPath(new URL('../scripts', import.meta.url)), join(directory, 'tools'), 'dir');
const installer = new URL('file://' + join(directory, 'tools/install-zip.js')).href;
const selector = fileURLToPath(new URL('../scripts/prepare-zip-install.sh', import.meta.url));
const uuid = 'smartphone-rc@jfaparicio.github.io';
const base = `Main.extensionManager.lookup(${JSON.stringify(uuid)})`;
function evaluate(expression) {
    const code = `(async()=>{const value=await (${expression});GLib.file_set_contents(${JSON.stringify(output)},JSON.stringify(value));return true;})()`;
    const result = execFileSync('gdbus', ['call', '--address', bus, '--dest', 'org.gnome.Shell', '--object-path',
        '/org/gnome/Shell', '--method', 'org.gnome.Shell.Eval', code], {encoding: 'utf8', timeout: 45000});
    assert.ok(result.startsWith('(true,'), result);
    return JSON.parse(readFileSync(output, 'utf8'));
}
function select(archive) {
    const text = evaluate(`new Promise((resolve,reject)=>{
        const child=Gio.Subprocess.new(${JSON.stringify(['bash', selector, archive])},Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDERR_PIPE);
        child.communicate_utf8_async(null,null,(source,result)=>{
            try {const [,out,errors]=source.communicate_utf8_finish(result);if(!source.get_successful())throw Error(errors);resolve(out);}catch(error){reject(error);}
        });
    })`);
    const command = text.split('\n').find(line => line.startsWith('await '));
    assert.ok(command, text);
    return command;
}

try {
    execFileSync('python3', ['-c', `import json,sys,zipfile
from pathlib import Path
root=Path(sys.argv[1])
uuid=${JSON.stringify(uuid)}
for name,version in [('first',1),('second',2),('broken',3),('wrong',4)]:
 metadata={'uuid':uuid if name!='wrong' else 'unrelated@example.com','name':'ZIP native fixture','description':'Isolated test only','shell-version':['51'],'version-name':f'1.0.{version}','version':version}
 source="import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';\\n"+"import {marker} from './nested/marker.js';\\nexport default class Probe extends Extension {enable(){this.marker=marker;}disable(){}}\\n"
 with zipfile.ZipFile(root/(name+'.zip'),'w') as archive:
  archive.writestr('metadata.json',json.dumps(metadata))
  archive.writestr('extension.js',source)
  if name!='broken':archive.writestr('nested/marker.js',f'export const marker={version};\\n')
  archive.writestr('schemas/org.gnome.shell.extensions.smartphone-rc.gschema.xml',"""<schemalist><schema id="org.gnome.shell.extensions.smartphone-rc" path="/org/gnome/shell/extensions/smartphone-rc/"><key name="fixture" type="s"><default>'fixture'</default></key></schema></schemalist>""")
`, directory]);
    const installedPath = evaluate(`GLib.get_user_data_dir()+'/gnome-shell/extensions/'+${JSON.stringify(uuid)}`);
    const settingsExpression = `['enabled-extensions','disabled-extensions'].map(key=>global.settings.get_strv(key))`;
    const initialSettings = evaluate(settingsExpression);
    assert.equal(existsSync(installedPath), false, 'Start with no project installation in the isolated profile');
    const firstFailure = evaluate(`(await import(${JSON.stringify(installer)})).installZip(${JSON.stringify(join(directory, 'broken.zip'))}).then(()=>null,error=>error.message)`);
    assert.match(firstFailure, /Previous installation restored/);
    assert.equal(existsSync(installedPath), false);
    assert.deepEqual(evaluate(settingsExpression), initialSettings);
    console.log('PASS: failed first installation leaves no installed directory or enabled/disabled settings changes');
    const wrappers = join(directory, 'wrappers');
    mkdirSync(wrappers);
    const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
    const unzip = execFileSync('which', ['unzip'], {encoding: 'utf8'}).trim();
    writeFileSync(join(wrappers, 'unzip'), `#!/bin/sh\ncp -- ${quote(join(directory, 'wrong.zip'))} ${quote(join(directory, 'first.zip'))}\nexec ${quote(unzip)} "$@"\n`, {mode: 0o700});
    const first = evaluate(`(async()=>{const old=GLib.getenv('PATH');
        GLib.setenv('PATH',${JSON.stringify(wrappers)}+':'+old,true);
        try{return await (await import(${JSON.stringify(installer)})).installZip(${JSON.stringify(join(directory, 'first.zip'))});}
        finally{GLib.setenv('PATH',old,true);}})()`);
    assert.notEqual(JSON.parse(execFileSync(unzip, ['-p', join(directory, 'first.zip'), 'metadata.json'], {encoding: 'utf8'})).uuid, uuid);
    console.log('PASS: replacing the original ZIP during real validation cannot change the installed snapshot');
    assert.match(first, /Installed and loaded 1\.0\.1/);
    const firstPath = evaluate(`${base}.path`);
    assert.equal(evaluate(`${base}.stateObj.marker`), 1);
    assert.equal(evaluate(`${base}.metadata.version`), 1);
    assert.ok(existsSync(join(installedPath, 'schemas/gschemas.compiled')));
    assert.equal(statSync(join(firstPath, 'nested/marker.js')).ino, statSync(join(installedPath, 'nested/marker.js')).ino);
    const rememberedCommand = select(join(directory, 'second.zip'));
    evaluate(rememberedCommand);
    const secondPath = evaluate(`${base}.path`);
    assert.notEqual(firstPath, secondPath);
    assert.equal(evaluate(`${base}.stateObj.marker`), 2);
    assert.equal(evaluate(`${base}.metadata.version`), 2);
    assert.equal(JSON.parse(readFileSync(join(installedPath, 'metadata.json'), 'utf8')).version, 2);
    assert.equal(statSync(join(secondPath, 'nested/marker.js')).ino, statSync(join(installedPath, 'nested/marker.js')).ino);
    console.log('PASS: official ZIP installation and compiled schemas; fresh dependency code and numeric versions load from the actual installed files');
    const wrong = evaluate(`(await import(${JSON.stringify(installer)})).installZip(${JSON.stringify(join(directory, 'wrong.zip'))}).then(()=>null,error=>error.message)`);
    assert.match(wrong, /only accepts/);
    assert.equal(evaluate(`${base}.stateObj.marker`), 2);
    assert.equal(evaluate(`${base}.path`), secondPath);
    console.log('PASS: wrong UUID rejected before unloading the active extension');
    assert.equal(select(join(directory, 'broken.zip')), rememberedCommand);
    const broken = evaluate(`(async()=>${rememberedCommand})().then(()=>null,error=>error.message)`);
    assert.match(broken, /Previous installation restored/);
    assert.equal(evaluate(`${base}.stateObj.marker`), 2);
    assert.equal(evaluate(`${base}.metadata.version`), 2);
    assert.equal(JSON.parse(readFileSync(join(installedPath, 'metadata.json'), 'utf8')).version, 2);
    console.log('PASS: import failure restores and reloads the previous installed ZIP');
    evaluate(`(async()=>{Main.extensionManager.disableExtension(${JSON.stringify(uuid)});
        for(let i=0;i<250&&${base}.state!==2;i++) await new Promise(resolve=>GLib.timeout_add(GLib.PRIORITY_DEFAULT,20,()=>{resolve();return GLib.SOURCE_REMOVE;}));
        return ${base}.state;})()`);
    assert.equal(evaluate(`${base}.state`), 2);
    const disabledSettings = evaluate(settingsExpression);
    const disabledFailure = evaluate(`(async()=>${rememberedCommand})().then(()=>null,error=>error.message)`);
    assert.match(disabledFailure, /Previous installation restored/);
    assert.deepEqual(evaluate(settingsExpression), disabledSettings);
    assert.ok([2, 6].includes(evaluate(`${base}.state`)), 'Restored copy must remain inactive or initialized');
    assert.equal(evaluate(`${base}.metadata.version`), 2);
    assert.equal(JSON.parse(readFileSync(join(installedPath, 'metadata.json'), 'utf8')).version, 2);
    console.log('PASS: failed update restores the installed ZIP and keeps a previously disabled extension disabled');
    assert.equal(select(actualArchive), rememberedCommand);
    evaluate(rememberedCommand);
    console.log('PASS: generated Looking Glass command stays identical while the selected ZIP changes');
    assert.equal(evaluate(`${base}.metadata.uuid`), uuid);
    assert.equal(evaluate(`${base}.state`), 1);
    assert.ok(existsSync(join(installedPath, 'app/service-worker.js')));
    assert.equal(evaluate('Main.extensionManager.lookup("test-driver@smartphone-rc.local").state'), 1);
    console.log('PASS: real project ZIP installed and active; other extensions remain active');
} finally { rmSync(directory, {recursive: true, force: true}); }
