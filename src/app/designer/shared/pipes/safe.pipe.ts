import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
    name: 'safe'
})
export class SafePipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) {}
    transform(value: string, type?: string) {
        switch (type) {
            case 'style':
                return this.sanitizer.bypassSecurityTrustStyle(value);

            default:
                return this.sanitizer.bypassSecurityTrustResourceUrl(value);
        }
    }
}
