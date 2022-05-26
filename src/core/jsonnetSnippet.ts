export default function JsonnetSnippet(plugins:any) {
    let snippet = `local inputs = std.extVar('inputs');
        local mappings = std.extVar('mappings');
        local config = std.extVar('config');
    `;

    for (let fn in plugins) {
        let f = fn.split('.');
        fn = f[f.length - 1];

        snippet += `
            local ${fn} = std.native('${fn}');
            `;
    }

    return snippet;
}