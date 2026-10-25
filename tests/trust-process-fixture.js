import Gio from 'gi://Gio';
import {TrustedBrowsers} from '../trusted.js';

const settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.smartphone-rc'});
const store = new TrustedBrowsers(settings);
const [operation, value] = ARGV;
if (operation === 'remember')
    store.remember(value);
else if (operation === 'forget')
    store.forget(value);
else if (operation === 'forget-all')
    store.forgetAll();
else if (operation === 'stale-write')
    settings.set_string('trusted-browsers', value);
Gio.Settings.sync();
print(JSON.stringify({records: store.list(), grants: settings.get_string('trusted-browsers')}));
