import {textChange, recentText} from './editing.js';

export function createKeyboard(send, isApproved) {
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
    }

    function editText() {
        if (!isApproved() || composing)
            return;
        const value = $('text').value;
        const change = textChange(lastText, value);
        if (change.remove || change.text)
            send({type: 'edit', context: editContext, ...change});
        // Keep a small correction buffer; older text is already on the PC.
        const recent = recentText(value);
        if (recent !== value) {
            const trimmed = value.length - recent.length;
            const start = Math.max(0, $('text').selectionStart - trimmed);
            const end = Math.max(0, $('text').selectionEnd - trimmed);
            $('text').value = recent;
            $('text').setSelectionRange(start, end);
        }
        lastText = recent;
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
