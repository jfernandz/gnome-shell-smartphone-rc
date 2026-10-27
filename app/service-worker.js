#!@GJS@ -m
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {DBusPeer, connectToParent, cleanupPeerDirectory} from '../dbus.js';
import {RemoteServer} from './server.js';
import {TrustedBrowsers} from '../trusted.js';
import {isVolumeState} from '../protocol.js';
import {isSensitivityRange} from '../limits.js';

const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_path();
const loop = new GLib.MainLoop(null, false);
let server = null;
let unwatch = null;
const finish = () => { server?.stop(); unwatch?.(); loop.quit(); };
if (ARGV.length !== 3 || !Number.isSafeInteger(Number(ARGV[1])) || Number(ARGV[1]) <= 0)
    throw Error('A private D-Bus address, parent PID and socket directory are required.');
const connection = await connectToParent(ARGV[0], Number(ARGV[1]));
const peer = new DBusPeer(connection, 'service', command => {
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
            server = new RemoteServer(directory, state => peer.send({type: 'state', state,
                peer: server?.peer ?? null, browserName: server?.browserName ?? null}),
            input => peer.send({type: 'input', input}), {...options, certificate, trusted});
            unwatch = trusted.watch(() => server.checkTrust());
            const url = server.start();
            const fingerprint = certificate
                ? GLib.compute_checksum_for_data(GLib.ChecksumType.SHA256, certificate.certificate).toUpperCase().match(/.{2}/g).join(':') : null;
            peer.send({type: 'started', url, fingerprint});
        } catch (error) {
            peer.send({type: 'error', message: `Could not start the network service: ${error.message}`.slice(0, 512)});
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
        else if (isVolumeState(message))
            server?.send({type: 'volume-state', available: message.available, output: message.output, level: message.level, muted: message.muted});
        else
            finish();
    } else {
        finish();
    }
}, finish);
connection.start_message_processing();
peer.send({type: 'ready'});
loop.run();
peer.close();
cleanupPeerDirectory(ARGV[2]);
