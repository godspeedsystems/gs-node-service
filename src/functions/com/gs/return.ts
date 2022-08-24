export default function(...args:any[]) {
    args.pop();
    if (args.length == 1) {
        return args[0];
    }
    
    return args;
}
