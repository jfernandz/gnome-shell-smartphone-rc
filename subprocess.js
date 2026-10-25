import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Always reap the direct child before callers remove its staging files.
export async function runCommand(argv, {cancellable = null, timeoutMs = 15000,
    packageName = argv[0], operation = 'Command failed'} = {}) {
    const tool = GLib.find_program_in_path(argv[0]);
    if (!tool)
        throw new Error(`${packageName} is required (${argv[0]} was not found). Install it using your system package manager, then try again.`);
    cancellable?.set_error_if_cancelled();
    const process = Gio.Subprocess.new([tool, ...argv.slice(1)], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    let timedOut = false;
    let finished = false;
    const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
        timedOut = true;
        process.force_exit();
        return GLib.SOURCE_REMOVE;
    });
    try {
        const [, output, error] = await new Promise((resolve, reject) =>
            process.communicate_utf8_async(null, cancellable, (source, result) => {
                try { resolve(source.communicate_utf8_finish(result)); } catch (e) { reject(e); }
            }));
        finished = true;
        if (timedOut)
            throw new Error(`${operation}: the command timed out. Try again.`);
        if (!process.get_successful())
            throw new Error(`${operation}. ${error.trim().slice(0, 512) || 'Check the tool installation and try again.'}`);
        return output;
    } finally {
        if (GLib.MainContext.default().find_source_by_id(timer))
            GLib.Source.remove(timer);
        if (!finished)
            process.force_exit();
        // Waiting must not use the cancelled communication token.
        await new Promise((resolve, reject) => process.wait_async(null, (source, result) => {
            try { source.wait_finish(result); resolve(); } catch (error) { reject(error); }
        }));
    }
}
