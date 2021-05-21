export class StrUtils {
    static nonEmptyString(str: string): boolean {
        return str && str != 'null' && str != null && str != ''; // JSON5 returns "null", more info https://stackoverflow.com/questions/21120999/representing-null-in-json
    }

    static isValidString(str: string): boolean {
        if (str || str === '') {
            return true;
        }

        return false;
    }

    static isBase64String(str: string): boolean {
        return str.substr(0, 11) === 'data:image/';
    }

    // useful when "null" as the result of String(null) is not appropriate
    static numberToString(num: number, nullCase: any = null) {
        if (num === null || num === undefined || isNaN(num)) {
            return nullCase;
        }
        return num.toString();
    }

    static changeFileName(fullPath: string, newFileName: string): string {
        let path: string = '';
        let i: number = fullPath.lastIndexOf('/');

        if (i !== -1) {
            path = fullPath.substring(0, i + 1);
        }

        let ext: string = '';
        let j: number = fullPath.lastIndexOf('.');

        if (j !== -1) {
            // the extension (e.g. ".jpg")
            ext = fullPath.substr(j);
        }

        return path + newFileName + ext;
    }

    static getFileName(value: string, short: boolean = true): string {
        let i: number = value.lastIndexOf('/');

        if (i !== -1) {
            value = value.substr(i + 1);
        }

        if (short) {
            // cut off the extension
            let j: number = value.lastIndexOf('.');

            if (j !== -1) {
                value = value.substring(0, j);
            }
        }

        return value;
    }

    static getExtension(value: string, noPoint: boolean = true): string {
        let ext: string = '';
        let j: number = value.lastIndexOf('.');

        if (j !== -1) {
            ext = value.substr(j + (noPoint ? 1 : 0));
        }

        return ext;
    }
}
