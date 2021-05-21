import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    // html text - allowed tags: <b>, <title>, <small>
    manufacturersNote: string;
    // html text - allowed tags: <b>, <title>, <small>
    copyrightNotice: string;
    // always shown (right side of an exported image, power-of-2 size preferred)
    userLogo: string;
    // if defined - it's used instead of the site theme logo in the header (don't set any default value here)
    monuvisionOverrideLogo: string;
    // can be toggled (left side of an exported image, power-of-2 size preferred)
    companyLogo: string;

    buyNowText: string;

    buyNowPricing: boolean;

    pricing: boolean;

    constructor(private config: ConfigService, private http: HttpClient) {}

    init() {
        this.getAccountInfo();
    }

    getAccountInfo() {
        let url: string =
            this.config.testMode.indexOf('account') >= 0 ? this.config.assetsURL + 'test/account.json' : this.config.apiURL + 'account';
        return this.http
            .get<any>(url)
            .toPromise()
            .then((result) => {
                if (result) {
                    this.manufacturersNote =
                        result.manufacturers_note ||
                        '<b>Note to Manufacturer: </b><small>Please make any minor adjustments necessary in this conceptual design to insure best quality production. Thank you.\n\nSigned ____________________________________________         Date________________</small>';

                    this.copyrightNotice =
                        result.copyright_notice ||
                        '<b>Copyright Notice: </b><small>This design, layout, look, appearance and graphics are property of MonumentPro, Inc, and the memorial company listed above and is protected by applicable copyright laws.  Unauthorized use or duplication is prohibited.</small>';

                    this.userLogo = result.user_logo;

                    this.monuvisionOverrideLogo = result.monuvision_override_logo;

                    this.companyLogo = result.company_logo;

                    if (result.submit_button && result.submit_button.show) {
                        this.buyNowText = result.submit_button.text;
                        this.buyNowPricing = result.submit_button.pricing;
                    }

                    this.pricing = !(result.pricing === false);
                }

                return result;
            });
    }
}
