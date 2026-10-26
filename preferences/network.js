import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {configDirectory, localAddresses, readNetworkConfig, configureNetwork} from '../network-config.js';

export function createNetworkGroup(onConfigChanged = null) {
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
    const cancellable = new Gio.Cancellable();
    function showConfig(config) {
        address.text = config.address;
        port.value = config.port;
        status.title = `Configured: https://${config.address}:${config.port}`;
        status.subtitle = 'Start remote control from the top-bar menu. Certificate details are in Security.';
        onConfigChanged?.(config);
    }
    async function loadConfig() {
        try {
            const config = await readNetworkConfig(configDirectory(), cancellable);
            if (!disposed && !busy) showConfig(config);
        } catch (error) {
            if (disposed || busy) return;
            const configured = GLib.file_test(`${configDirectory()}/network.json`, GLib.FileTest.EXISTS);
            onConfigChanged?.(null, configured ? error.message : null);
            status.subtitle = configured ? error.message
                : 'OpenSSL and iproute2 are required. Configure networking here before starting remote control.';
        }
    }
    choices.connect('notify::selected', () => {
        if (detected[choices.selected]) address.text = detected[choices.selected].address;
    });
    async function discover() {
        refresh.sensitive = false;
        try {
            const result = await localAddresses(cancellable);
            if (disposed) return;
            const previous = address.text;
            detected = result;
            choices.model = Gtk.StringList.new(result.map(item => `${item.address} (${item.name})`));
            if (previous) address.text = previous;
            if (result.length && ['Address detection failed', 'No private LAN IPv4 address found'].includes(status.title)) {
                status.title = 'Addresses refreshed';
                status.subtitle = 'Choose an address, then press Apply to save it. Existing configuration remains unchanged until then.';
            }
            if (!result.length) {
                status.title = 'No private LAN IPv4 address found';
                status.subtitle = 'Connect the PC to your local network, then press Refresh.';
            }
        } catch (error) {
            if (!disposed) { status.title = 'Address detection failed'; status.subtitle = error.message; }
        } finally { if (!disposed) refresh.sensitive = !busy; }
    }
    refresh.connect('clicked', () => discover());
    configure.connect('clicked', async () => {
        if (busy) return;
        busy = true;
        configure.sensitive = address.sensitive = port.sensitive = choices.sensitive = false;
        status.title = 'Configuring networking…';
        try {
            const config = await configureNetwork(address.text.trim(), Math.round(port.value), cancellable);
            if (!disposed) showConfig(config);
        } catch (error) {
            if (!disposed) { status.title = 'Configuration failed'; status.subtitle = error.message; }
        } finally {
            busy = false;
            if (!disposed) configure.sensitive = address.sensitive = port.sensitive = choices.sensitive = true;
        }
    });
    loadConfig().then(() => { if (!disposed) discover(); });
    return {
        group,
        focusAddress() { address.grab_focus(); },
        destroy() { disposed = true; cancellable.cancel(); },
    };
}
