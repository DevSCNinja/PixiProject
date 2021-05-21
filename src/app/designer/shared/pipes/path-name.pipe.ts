import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'pathName'
})
export class PathNamePipe implements PipeTransform {
    transform(value: string, short?: boolean): any {
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
}
