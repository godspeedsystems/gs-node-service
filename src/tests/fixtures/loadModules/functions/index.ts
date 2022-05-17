
export function entry(...args:any[]) {
  if (args.length == 1) {
      return args[0];
  }
  return args;
}