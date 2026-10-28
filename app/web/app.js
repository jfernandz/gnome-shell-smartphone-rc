import {createClient} from './client.js';

createClient();

const controls = document.getElementById('controls');
document.getElementById('keyboard').addEventListener('click', () => controls.hidePopover());
controls.addEventListener('beforetoggle', event => {
    if (event.newState === 'closed' && controls.contains(document.activeElement))
        document.getElementById('controls-toggle').focus({preventScroll: true});
});
document.getElementById('text').addEventListener('focus', () => controls.hidePopover());
