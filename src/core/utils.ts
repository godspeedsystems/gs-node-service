export function getAtPath(obj: {[key: string]: any; }, path: string) {
  const keys = path.split('.');
  for (const key of keys) {
    if (key in obj) { //obj[key]
      obj = obj[key];
    } else {
      return undefined;
    }
  }
  return obj;
}
export function setAtPath(o: {[key: string]: any; }, path: string, value: any) {
  const keys = path.split('.');
  let obj = o;
  //prepare the array to ensure that there is nested {[key: string]: any; } till the last key
  //Ensure there is an {[key: string]: any; } as value till the second last key
  for (let i = 0; i< keys.length - 1; i++) {
    const key = keys[i];
    if (key in obj) { //obj[key]
      obj = obj[key];
    } else {
      obj = (obj[key] = {});
    }
  }
  const lastKey = keys[keys.length - 1];
  obj[lastKey] = value;
}