import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {configDirectory, localAddresses, readNetworkConfig, configureNetwork} from '../network-config.js';

export function createNetworkGroup(onConfigChanged = null, {
    readConfig = readNetworkConfig, detectAddresses = localAddresses, applyConfig = configureNetwork,
} = {}) {
    const group = new Adw.PreferencesGroup({title: 'Network',
        description: 'Choose the PC address reachable by your phone. Configuration does not start remote control or change the firewall.'});
    const address = new Adw.EntryRow({title: 'LAN IPv4 address'});
    const choices = new Adw.ComboRow({title: 'Detected addresses', model: Gtk.StringList.new([])});
    const refresh = new Gtk.Button({label: 'Refresh', valign: Gtk.Align.CENTER});
    choices.add_suffix(refresh);
    const port = new Adw.SpinRow({title: 'Port', subtitle: 'Allow this TCP port in your firewall if needed.',
        adjustment: new Gtk.Adjustment({lower: 1024, upper: 65535, step_increment: 1, page_increment: 100, value: 8844})});
    const status = new Adw.ActionRow({title: 'Not configured', subtitle: 'Choose an address, then press Apply.'});
    const configure = new Gtk.Button({label: 'Apply', valign: Gtk.Align.CENTER});
    configure.add_css_class('suggested-action');
    const action = new Adw.ActionRow({title: 'Apply network configuration',
        subtitle: 'Saves the address and port and creates or renews the certificate for that address. Stop remote control first; restart it afterwards and verify the new certificate in Security.'});
    action.add_suffix(configure);
    for (const row of [address, choices, port, status, action]) group.add(row);
    let disposed = false;
    let busy = false;
    let detected = [];
    let configurationRevision = 0;
    let discoveryRequest = 0;
    let updatingChoices = false;
    const cancellable = new Gio.Cancellable();
    function showConfig(config, updateForm = true) {
        if (updateForm) {
            address.text = config.address;
            port.value = config.port;
        }
        status.title = `Configured: https://${config.address}:${config.port}`;
        status.subtitle = 'Start remote control from the top-bar menu. Certificate details are in Security.';
        onConfigChanged?.(config);
    }
    async function loadConfig() {
        const revision = configurationRevision;
        const initialAddress = address.text;
        const initialPort = port.value;
        try {
            const config = await readConfig(configDirectory(), cancellable);
            if (!disposed && revision === configurationRevision)
                showConfig(config, address.text === initialAddress && port.value === initialPort);
        } catch (error) {
            if (disposed || revision !== configurationRevision) return;
            const configured = GLib.file_test(`${configDirectory()}/network.json`, GLib.FileTest.EXISTS);
            onConfigChanged?.(null, configured ? error.message : null);
            status.subtitle = configured ? error.message
                : 'OpenSSL and iproute2 are required. Configure networking here before starting remote control.';
        }
    }
    choices.connect('notify::selected', () => {
        if (!updatingChoices && detected[choices.selected]) address.text = detected[choices.selected].address;
    });
    async function discover() {
        if (disposed || busy) return;
        const request = ++discoveryRequest;
        const revision = configurationRevision;
        const initialAddress = address.text;
        const current = () => !disposed && request === discoveryRequest && revision === configurationRevision;
        refresh.sensitive = false;
        try {
            const result = await detectAddresses(cancellable);
            if (!current()) return;
            const untouched = address.text === initialAddress;
            detected = result;
            updatingChoices = true;
            try {
                choices.model = Gtk.StringList.new(result.map(item => `${item.address} (${item.name})`));
            } finally {
                updatingChoices = false;
            }
            if (!address.text && untouched && result.length)
                address.text = result[0].address;
            if (result.length && ['Address detection failed', 'No private LAN IPv4 address found'].includes(status.title)) {
                status.title = 'Addresses refreshed';
                status.subtitle = 'Choose an address, then press Apply to save it. Existing configuration remains unchanged until then.';
            }
            if (!result.length) {
                status.title = 'No private LAN IPv4 address found';
                status.subtitle = 'Connect the PC to your local network, then press Refresh.';
            }
        } catch (error) {
            if (current()) { status.title = 'Address detection failed'; status.subtitle = error.message; }
        } finally { if (current()) refresh.sensitive = true; }
    }
    refresh.connect('clicked', () => discover());
    configure.connect('clicked', async () => {
        if (disposed || busy) return;
        busy = true;
        // Applying invalidates startup reads and in-flight discovery, including their errors.
        configurationRevision++;
        discoveryRequest++;
        configure.sensitive = address.sensitive = port.sensitive = choices.sensitive = refresh.sensitive = false;
        status.title = 'Configuring networking…';
        try {
            const config = await applyConfig(address.text.trim(), Math.round(port.value), cancellable);
            if (!disposed) showConfig(config);
        } catch (error) {
            if (!disposed) { status.title = 'Configuration failed'; status.subtitle = error.message; }
        } finally {
            busy = false;
            if (!disposed) configure.sensitive = address.sensitive = port.sensitive = choices.sensitive = refresh.sensitive = true;
        }
    });
    loadConfig().then(() => { if (!disposed && configurationRevision === 0) discover(); });
    return {
        group,
        focusAddress() { address.grab_focus(); },
        destroy() { disposed = true; cancellable.cancel(); },
    };
}
