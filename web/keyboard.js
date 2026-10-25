import {editMessages} from './editing.js';

export function createKeyboard(send, isApproved, environment = globalThis) {
    const {document, navigator} = environment;
    const $ = id => document.getElementById(id);
    let editContext = 0;
    let lastText = '';
    let composing = false;

    function reset() {
        $('text').value = '';
        lastText = '';
        composing = false;
    }

    function show() {
        if (!isApproved())
            return;
        $('typing').hidden = false;
        document.body.classList.add('typing');
        $('text').focus({preventScroll: true});
        try {
            navigator.virtualKeyboard?.show();
        } catch {
            // A browser may require the user to tap the editor directly.
        }
    }

    function hide() {
        $('text').blur();
        $('typing').hidden = true;
        document.body.classList.remove('typing');
    }

    function editText() {
        if (!isApproved() || composing)
            return;
        const value = $('text').value;
        for (const message of editMessages(lastText, value, editContext))
            send(message);
        // Leave the DOM value and selection alone: the mobile IME owns them.
        lastText = value;
    }

    function enter() {
        editText();
        send({type: 'key', key: 'Enter', context: editContext});
        reset();
    }

    $('keyboard').addEventListener('click', () => {
        if ($('typing').hidden)
            show();
        else
            hide();
    });
    $('text').addEventListener('compositionstart', () => composing = true);
    $('text').addEventListener('compositionend', () => {
        composing = false;
        editText();
    });
    $('text').addEventListener('input', event => {
        if (!event.isComposing)
            editText();
    });
    $('text').addEventListener('beforeinput', event => {
        if (event.isComposing || composing)
            return;
        if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
            event.preventDefault();
            enter();
        } else if (event.inputType === 'deleteContentBackward' && !$('text').value) {
            event.preventDefault();
            send({type: 'edit', context: editContext, remove: 1, text: ''});
        }
    });
    $('text').addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing && !composing) {
            event.preventDefault();
            enter();
        }
    });
    $('text-form').addEventListener('submit', event => {
        event.preventDefault();
        enter();
    });

    return {
        reset, show, hide,
        focus(message) {
            editContext = message.context;
            reset();
            $('text').type = message.sensitive ? 'password' : 'text';
            $('text').autocomplete = 'off';
            if (message.active)
                show();
            else
                hide();
        },
    };
}
