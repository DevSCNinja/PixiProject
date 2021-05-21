import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ColorUtils } from '../utils/color-utils';
import { ConfigService } from './config.service';

@Injectable({
    providedIn: 'root'
})
export class UIService {
    blockUIPreloader: boolean = true;

    blockUIForGestures: boolean = false;

    displayZoomControls: boolean = true;

    displayPricing: boolean = false;

    displayWholesalePricing: boolean = false;

    displaySceneExportPrint: boolean = false;

    displaySceneExportEmailDownload: boolean = false;

    displaySceneExportBuyNow: boolean = false;
    // dialogs:
    displaySceneLibrary: boolean = false;

    displaySceneSaveLibrary: boolean = false;

    displayBgLibrary: boolean = false;

    displayArtLibrary: boolean = false;

    displayVaseLibrary: boolean = false;

    displayShapeLibrary: boolean = false;

    displayRefresh: boolean = false;

    displayHelp: boolean = false;
    // default
    primaryColor: string;
    // bg (the area around the canvas)
    secondaryColor: string;
    // active
    tertiaryColor: string;
    // hover
    quaternaryColor: string;
    // shadow (can be used as 'disabled')
    quinaryColor: string;
    // wholesale pricing
    senaryColor: string;
    // header logo (don't set any default value here)
    logo: string;

    designerName: string;

    contactEmail: string;

    defaultRecipientEmail: string;

    domain: string;

    url: string;

    downloadVectors: boolean;

    showBuyNowTecstoneMessage: boolean;

    isThemeApplied: boolean = false;

    timeoutIds: any = {};

    constructor(private config: ConfigService, private http: HttpClient) {}

    init() {
        return new Promise<any>((resolve, reject) => {
            this.getSiteTheme().finally(() => {
                this.applySiteTheme();
                resolve(true);
            });
        });
    }

    closeDialogs() {
        this.displayHelp = false;
        this.displaySceneLibrary = false;
        this.displaySceneSaveLibrary = false;
        this.displayBgLibrary = false;
        this.displayArtLibrary = false;
        this.displayVaseLibrary = false;
        this.displayShapeLibrary = false;
    }

    closeExportSections() {
        this.displaySceneExportPrint = false;
        this.displaySceneExportEmailDownload = false;
        this.displaySceneExportBuyNow = false;
    }

    showGesturesPopup = (lifetime: number = 3000) => {
        if (this.blockUIForGestures) {
            return;
        }
        this.blockUIForGestures = true;

        clearTimeout(this.timeoutIds['gestures']);
        this.timeoutIds['gestures'] = setTimeout(this.hideGesturesPopup, lifetime);
    };

    hideGesturesPopup = () => {
        if (!this.blockUIForGestures) {
            return;
        }
        this.blockUIForGestures = false;
    };

    getSiteTheme() {
        let url: string =
            this.config.testMode.indexOf('site') >= 0 ? this.config.assetsURL + 'test/site.json' : this.config.apiURL + 'site';
        return this.http
            .get<any>(url)
            .toPromise()
            .then((result) => {
                if (result) {
                    this.primaryColor = result.primary_color;
                    this.secondaryColor = result.secondary_color;
                    this.tertiaryColor = result.tertiary_color;
                    this.quaternaryColor = result.quaternary_color;
                    this.quinaryColor = result.quinary_color;
                    this.senaryColor = result.senary_color;
                    this.logo = this.config.getAssetFullURL(result.logo);
                    this.designerName = result.designer_name;
                    this.contactEmail = result.contact_email;
                    this.defaultRecipientEmail = result.default_recipient;
                    this.domain = result.domain;
                    this.url = result.url;
                    this.downloadVectors = result.download_vectors;
                    this.showBuyNowTecstoneMessage = this.url.includes('tecstone');
                }

                return result;
            });
    }

    protected applySiteTheme() {
        // apply colors
        if (this.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', this.primaryColor);

            // calculate some colors if not defined
            if (!this.quaternaryColor) {
                // hover color
                let pc: number = ColorUtils.string2hex(this.primaryColor);
                let br: number = ColorUtils.getColorBrightness(pc);
                if (br < 0.6) {
                    // lighter
                    this.quaternaryColor = ColorUtils.shadeBlendConvert(0.2, this.primaryColor);
                } else {
                    // darker
                    this.quaternaryColor = ColorUtils.shadeBlendConvert(-0.25, this.primaryColor);
                }
            }
            if (!this.quinaryColor) {
                // 'shadow' (on focus) color (may be used as 'disabled' color instead of currently used opacity 0.5)
                this.quinaryColor = ColorUtils.shadeBlendConvert(0.5, this.primaryColor);
            }
            if (!this.senaryColor) {
                // wholesale pricing
                let pc: number = ColorUtils.string2hex(this.secondaryColor);
                let br: number = ColorUtils.getColorBrightness(pc);
                if (br < 0.6) {
                    // lighter
                    this.senaryColor = ColorUtils.shadeBlendConvert(0.2, this.secondaryColor);
                } else {
                    // darker
                    this.senaryColor = ColorUtils.shadeBlendConvert(-0.25, this.secondaryColor);
                }
            }
        }
        if (this.secondaryColor) {
            document.documentElement.style.setProperty('--secondary-color', this.secondaryColor);
        }
        if (this.tertiaryColor) {
            document.documentElement.style.setProperty('--tertiary-color', this.tertiaryColor);
        }
        if (this.quaternaryColor) {
            document.documentElement.style.setProperty('--quaternary-color', this.quaternaryColor);
        }
        if (this.quinaryColor) {
            document.documentElement.style.setProperty('--quinary-color', this.quinaryColor);
        }
        if (this.senaryColor) {
            document.documentElement.style.setProperty('--senary-color', this.senaryColor);
        }

        this.isThemeApplied = true;
    }
}
