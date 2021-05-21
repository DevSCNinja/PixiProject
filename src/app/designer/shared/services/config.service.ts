import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { StrUtils } from '../utils/str-utils';
import * as Bowser from 'bowser';
import * as PIXI from 'pixi.js';

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    appVersion: string = '0.2.16';

    testMode: string = 'color-font-shapes-arts-site-account-price'; // e.g. 'color-font-shapes-arts-scenes-json-xml-site-account-price-svg-help' (default is '')

    uploadURL: string = 'upload';

    uploadedFilesURL: string = 'upload/';

    assetsURL: string = 'monuvision-assets/';

    userAgent: Bowser.Parser.ParsedResult = Bowser.parse(window.navigator.userAgent);

    constructor() {
        if (this.isLocalServer) {
            console.log(':: Local Server ::');
        }

        if (environment.production) {
            this.testMode = '';
        }

        if (environment.corsEverywhere) {
            this.rewriteAllRequests();
        }

        this.uploadURL = this.apiURL + this.uploadURL;
    }

    protected rewriteAllRequests() {
        let cors_api_host = 'pixoid-cors.herokuapp.com';
        let cors_api_url = 'https://' + cors_api_host + '/';
        let slice = [].slice;
        let origin = window.location.protocol + '//' + window.location.host;
        let open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function () {
            let args = slice.call(arguments);
            let targetOrigin = /^https?:\/\/([^\/]+)/i.exec(args[1]);
            if (targetOrigin && targetOrigin[0].toLowerCase() !== origin && targetOrigin[1] !== cors_api_host) {
                args[1] = cors_api_url + args[1];
            }
            return open.apply(this, args);
        };

        /* let send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function () {
            this.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            return send.apply(this, arguments);
        };*/
    }

    isUploaded(url: string) {
        return url.indexOf(this.uploadedFilesURL) >= 0;
    }

    isLocalAsset(url: string) {
        return url.indexOf(this.assetsURL) >= 0;
    }

    getAssetPrefixURL(url: string, preferCORS: boolean = false) {
        let prefix: string = '';
        if (url) {
            if (StrUtils.isBase64String(url)) {
                prefix = '';
            } else {
                if (this.isLocalAsset(url)) {
                    //
                } else {
                    if (preferCORS && environment.corsEverywhere) {
                        prefix = this.corsURL;
                    } else {
                        prefix = environment.production || !this.isLocalServer ? '/' : this.url;
                    }
                }
            }
        }

        return prefix;
    }

    getAssetFullURL(url: string, preferCORS: boolean = false) {
        let prefix: string = this.getAssetPrefixURL(url, preferCORS);
        let short: string = this.getAssetShortURL(url);

        if (prefix.charAt(prefix.length - 1) === '/' && short.charAt(0) === '/') {
            short = short.substr(1);
        }

        return prefix + short;
    }

    getAssetShortURL(url: string) {
        let result: string = '';
        if (url) {
            if (this.isLocalAsset(url)) {
                result = url;
            } else {
                result = url.replace(/^(http:|https:)(?:\/\/|[^/]+)*/, '');
                if (environment.corsEverywhere) {
                    result = result.replace(/^\/(http:|https:)(?:\/\/|[^/]+)*/, '');
                }
            }
        }

        return result;
    }

    get url() {
        return environment.url;
    }

    get apiURL() {
        if (environment.production || !this.isLocalServer) {
            return this.getAssetFullURL(environment.apiURL);
        } else {
            return environment.apiURL;
        }
    }
    // don't use in production!
    get corsURL() {
        return 'https://pixoid-cors.herokuapp.com/' + this.url;
    }

    get production() {
        return environment.production;
    }

    get isLocalServer() {
        let host: string = window.location.hostname;

        return (
            host === 'monuvision.lvh.me' ||
            (!environment.production &&
                (host.substr(0, 5) === '127.0' || host.substr(0, 7) === '192.168' || host.substr(0, 9) === 'localhost'))
        );
    }

    get isDesktop() {
        // Bowser can return invalid values for some cases (e.g. Safari + ipadOS 14.0.1), so add extra check with Pixi
        return this.userAgent.platform.type === 'desktop' && !PIXI.utils.isMobile.any;
    }
}
