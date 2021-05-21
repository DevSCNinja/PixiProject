export class DateUtils {
    static getCurrentDate(includeHours: boolean = true): string {
        let today: Date = new Date();
        let dd: any = today.getDate();
        let mm: any = today.getMonth() + 1; //January is 0!
        let yyyy: any = today.getFullYear();
        let h: any = today.getHours();
        let min: any = today.getMinutes();
        let sec: any = today.getSeconds();

        if (dd < 10) {
            dd = '0' + dd;
        }

        if (mm < 10) {
            mm = '0' + mm;
        }

        if (h < 10) {
            h = '0' + h;
        }

        if (min < 10) {
            min = '0' + min;
        }

        if (sec < 10) {
            sec = '0' + sec;
        }

        let res: string = yyyy + '/' + mm + '/' + dd;
        if (includeHours) {
            res += ' ' + h + ':' + min + ':' + sec;
        }
        return res;
    }

    static getUndefinedDate(includeHours: boolean = true): string {
        let res: string = '----/---/--';
        if (includeHours) {
            res += ' --:--:--';
        }
        return res;
    }
}
