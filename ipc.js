import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Private inherited pipes only. Neither endpoint accepts a public socket or D-Bus name.
export class JsonPipe {
    constructor(input, output, onMessage, onEnd) {
        this._input = input;
        this._output = output;
        this._onMessage = onMessage;
        this._onEnd = onEnd;
        this._cancel = new Gio.Cancellable();
        this._buffer = new Uint8Array();
        this._queue = [];
        this._writing = false;
        this._window = 0;
        this._count = 0;
        this._read();
    }

    _read() {
        const input = this._input;
        input.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, this._cancel, (stream, result) => {
            if (this._input !== input)
                return;
            try {
                const chunk = stream.read_bytes_finish(result).get_data();
                if (!chunk.length) {
                    this._fail();
                    return;
                }
                const data = new Uint8Array(this._buffer.length + chunk.length);
                data.set(this._buffer);
                data.set(chunk, this._buffer.length);
                let start = 0;
                for (let index = 0; index < data.length; index++) {
                    if (data[index] !== 10)
                        continue;
                    if (index - start > 4096)
                        throw new Error('IPC line limit');
                    const time = GLib.get_monotonic_time();
                    if (time - this._window >= 1000000) {
                        this._window = time;
                        this._count = 0;
                    }
                    if (++this._count > 512)
                        throw new Error('IPC rate limit');
                    const value = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(data.subarray(start, index)));
                    if (!value || typeof value !== 'object' || Array.isArray(value))
                        throw new Error('Invalid IPC envelope');
                    this._onMessage(value);
                    if (!this._input)
                        return;
                    start = index + 1;
                }
                this._buffer = data.slice(start);
                if (this._buffer.length > 4096)
                    throw new Error('IPC line limit');
                this._read();
            } catch {
                this._fail();
            }
        });
    }

    send(message) {
        if (!this._output)
            return;
        const data = new TextEncoder().encode(`${JSON.stringify(message)}\n`);
        if (data.length > 4097 || this._queue.length >= 64) {
            this._fail();
            return;
        }
        this._queue.push(data);
        this._write();
    }

    _write() {
        if (this._writing || !this._queue.length || !this._output)
            return;
        const output = this._output;
        this._writing = true;
        output.write_all_async(this._queue.shift(), GLib.PRIORITY_DEFAULT, this._cancel, (stream, result) => {
            if (this._output !== output)
                return;
            try {
                stream.write_all_finish(result);
                this._writing = false;
                this._write();
            } catch {
                this._fail();
            }
        });
    }

    _fail() {
        const onEnd = this._onEnd;
        this.close();
        onEnd?.();
    }

    close() {
        this._onEnd = null;
        this._cancel.cancel();
        const input = this._input;
        const output = this._output;
        this._input = this._output = null;
        this._queue.length = 0;
        this._buffer = new Uint8Array();
        try { input?.close(null); } catch { /* Cancellation may already close the stream. */ }
        try { output?.close(null); } catch { /* Peer may already have exited. */ }
    }
}
