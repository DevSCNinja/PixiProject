import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import * as _ from 'lodash';
import { SceneModel, PriceModel } from '../models/main';
import { ConfigService } from './config.service';

@Injectable({
    providedIn: 'root'
})
export class PriceService {
    prices: PriceModel[] = [];
    // needed to make sure we show prices of the latest request
    lastPriceRequestID: number;

    isLoading: boolean = true;

    constructor(private config: ConfigService, private http: HttpClient, private msgService: MessageService) {}

    getPrices(sceneModel: SceneModel) {
        this.isLoading = true;
        // copy model and remove unnecessary and heavy props
        let lightWeightModel: SceneModel = _.cloneDeep(sceneModel);
        lightWeightModel.thumbnail = '';
        lightWeightModel.image = '';

        const body: any = { design: lightWeightModel };
        const test: boolean = this.config.testMode.indexOf('price') >= 0;
        const url: string = test ? this.config.assetsURL + 'test/prices.json' : this.config.apiURL + 'price';
        const reqID: number = (this.lastPriceRequestID = Math.round(Math.random() * 1000000000));

        if (test) {
            console.log('price request body', body);
            return this.http
                .get(url)
                .toPromise()
                .then((result) => {
                    if (Math.random() > 0.0) {
                        return this.parsePriceResponse(result, reqID);
                    } else {
                        throw new Error('Test Pricing Error');
                    }
                })
                .catch((err) => {
                    if (reqID === this.lastPriceRequestID) {
                        this.isLoading = false;
                        this.clearPrices();
                    }
                    console.warn(err);
                    this.msgService.add({ severity: 'error', summary: 'Pricing Service is not available', detail: '' });
                });
        } else {
            return this.http
                .post(url, body)
                .toPromise()
                .then((result) => {
                    return this.parsePriceResponse(result, reqID);
                })
                .catch((err) => {
                    if (reqID === this.lastPriceRequestID) {
                        this.isLoading = false;
                        this.clearPrices();
                    }
                    console.warn(err);
                    this.msgService.add({ severity: 'error', summary: 'Pricing Service is not available', detail: '' });
                });
        }
    }

    protected parsePriceResponse(result: any, reqID: number) {
        if (reqID === this.lastPriceRequestID) {
            this.isLoading = false;
            if (result && result instanceof Array) {
                // convert to the internal format
                this.prices = result.map((elem) => {
                    return {
                        value: elem.price.retail,
                        wholesaleValue: elem.price.wholesale,
                        label: '$ ' + elem.price.retail,
                        materialNames: [elem.line1, elem.line2]
                    };
                });
            }

            return result;
        }
        return null;
    }

    clearPrices() {
        this.prices = [];
    }
}
