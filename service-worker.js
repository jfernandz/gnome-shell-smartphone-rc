#!@GJS@ -m
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import {JsonPipe} from './ipc.js';
import {RemoteServer} from './server.js';
import {TrustedBrowsers} from './trusted.js';
import {isSensitivityRange} from './limits.js';

const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_path();
const loop = new GLib.MainLoop(null, false);
let server = null;
let unwatch = null;
const finish = () => { server?.stop(); unwatch?.(); loop.quit(); };
const pipe = new JsonPipe(new GioUnix.InputStream({fd: 0, close_fd: true}),
    new GioUnix.OutputStream({fd: 1, close_fd: true}), command => {
        if (command.type === 'start' && !server) {
            try {
                const options = command.options;
                if (!options || typeof options.address !== 'string' ||
                    !Number.isInteger(options.port) || options.port < 0 || options.port > 65535)
                    throw new Error('Invalid service configuration.');
                const source = Gio.SettingsSchemaSource.new_from_directory(`${directory}/schemas`, Gio.SettingsSchemaSource.get_default(), false);
                const settings = new Gio.Settings({settings_schema: source.lookup('org.gnome.shell.extensions.smartphone-rc', false)});
                const trusted = new TrustedBrowsers(settings);
                const certificate = options.certificatePath
                    ? Gio.TlsCertificate.new_from_files(options.certificatePath, options.privateKeyPath) : null;
                server = new RemoteServer(directory, state => pipe.send({type: 'state', state,
                    peer: server?.peer ?? null, browserName: server?.browserName ?? null}),
                input => pipe.send({type: 'input', input}), {...options, certificate, trusted});
                unwatch = trusted.watch(() => server.checkTrust());
                const url = server.start();
                const fingerprint = certificate
                    ? GLib.compute_checksum_for_data(GLib.ChecksumType.SHA256, certificate.certificate).toUpperCase().match(/.{2}/g).join(':') : null;
                pipe.send({type: 'started', url, fingerprint});
            } catch (error) {
                pipe.send({type: 'error', message: `Could not start the network service: ${error.message}`.slice(0, 512)});
            }
        } else if (command.type === 'approve' && typeof command.remember === 'boolean') {
            server?.approve(command.remember);
        } else if (command.type === 'disconnect') {
            server?.disconnect();
        } else if (command.type === 'settings' && isSensitivityRange(command.sensitivity)) {
            server?.setSensitivity(command.sensitivity);
        } else if (command.type === 'send') {
            const message = command.message;
            if (message?.type === 'focus' && Number.isSafeInteger(message.context) && message.context >= 0 &&
                typeof message.active === 'boolean' && typeof message.sensitive === 'boolean')
                server?.send({type: 'focus', context: message.context, active: message.active, sensitive: message.sensitive});
            else if (message?.type === 'typing-paused' && typeof message.message === 'string' && message.message.length <= 512)
                server?.send({type: 'typing-paused', message: message.message});
            else
                finish();
        } else {
            finish();
        }
    }, finish);
loop.run();
pipe.close();
