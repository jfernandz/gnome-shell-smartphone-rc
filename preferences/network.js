import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {configDirectory, localAddresses, readNetworkConfig, configureNetwork} from '../network-config.js';

export function createNetworkGroup() {
    const group = new Adw.PreferencesGroup({title: 'Network',
        description: 'Choose the PC address reachable by your phone. Configuration does not start remote control or change the firewall.'});
    const address = new Adw.EntryRow({title: 'LAN IPv4 address'});
    const choices = new Adw.ComboRow({title: 'Detected addresses', model: Gtk.StringList.new([])});
    const refresh = new Gtk.Button({label: 'Refresh', valign: Gtk.Align.CENTER});
    choices.add_suffix(refresh);
    const port = new Adw.SpinRow({title: 'Port', subtitle: 'Allow this TCP port in your firewall if needed.',
        adjustment: new Gtk.Adjustment({lower: 1024, upper: 65535, step_increment: 1, page_increment: 100, value: 8844})});
    const status = new Adw.ActionRow({title: 'Not configured', subtitle: 'Choose an address, then press Configure.'});
    const fingerprint = new Adw.ActionRow({title: 'Certificate SHA-256', subtitle: 'Not available', subtitle_selectable: true});
    const configure = new Gtk.Button({label: 'Configure', valign: Gtk.Align.CENTER});
    configure.add_css_class('suggested-action');
    const action = new Adw.ActionRow({title: 'Create or renew local certificate',
        subtitle: 'Valid for 90 days. Stop remote control before changing configuration; start it again afterwards. Verify the new certificate on the phone.'});
    action.add_suffix(configure);
    for (const row of [address, choices, port, status, fingerprint, action]) group.add(row);
    let disposed = false;
    let busy = false;
    let detected = [];
    const cancellable = new Gio.Cancellable();
    function showConfig(config) {
        address.text = config.address;
        port.value = config.port;
        status.title = `Configured: https://${config.address}:${config.port}`;
        status.subtitle = `Certificate expires ${config.expires}. Start remote control from the top-bar menu.`;
        fingerprint.subtitle = config.fingerprint;
    }
    try { showConfig(readNetworkConfig()); } catch (error) {
        status.subtitle = GLib.file_test(`${configDirectory()}/network.json`, GLib.FileTest.EXISTS)
            ? error.message
            : 'OpenSSL and iproute2 are required. Configure networking here before starting remote control.';
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
                status.subtitle = 'Choose an address, then press Configure to save it. Existing configuration remains unchanged until then.';
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
    discover();
    return {group, destroy() { disposed = true; cancellable.cancel(); }};
}
