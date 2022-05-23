
export function randomString(length: number, characters: string) {
    let result = '';

    if (!characters) {
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    }

    let charactersLength = characters.length;
    for(let i = 0; i < length; i++ ) {
        let c = characters.charAt(Math.floor(Math.random() * charactersLength));
        if (!result && c == '0') {
            continue
        }

        result += c;
    }
    return result;
}

export function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}