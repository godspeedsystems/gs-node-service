export default function(...args:any[]) {
  const popped = args.pop();
  if (args.length == 1) {
    return args[0];
  } else if (args.length == 0) {
    return popped;
  }
  return args;
}