import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import * as PIXI from 'pixi.js';
import _ from 'lodash';
import { Asset, BitmapFillItem, ColorItem, ShapeModel, DesignDataCategory, DesignDataColor, PixelData } from '../models/main';
import { ColorUtils } from '../utils/color-utils';
import { ConfigService } from './config.service';
import { MeasurementService } from './measurement.service';
import { ExportService } from './export.service';
import { MessageService } from 'primeng/api';

@Injectable({
    providedIn: 'root'
})
export class AssetService {
    static DEFAULT_BITMAP_FILL_ID: string = '0'; // will be rewritten

    static DEFAULT_SINKAGE_COLOR_ID: string = 'gray';

    static BLANK_BASE_64_IMG: string =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=';

    bitmapFills: { [key: string]: BitmapFillItem } = {
        /* will be filled with the colors, e.g.:
        '0': {
            url: 'monuvision-assets/images/lite_gray.png',
            id: '0',
            name: 'Lite Gray',
            thumbnail: 'monuvision-assets/images/thumbnail/thumb_lite_gray.png'
        },
        '0p': {
            url: 'monuvision-assets/images/lite_gray_pitch.png',
            id: '0p',
            name: 'Lite Gray Pitch',
            thumbnail: 'monuvision-assets/images/thumbnail/thumb_lite_gray.png'
        },
        '0s': {
            url: 'monuvision-assets/images/lite_gray_sand.png',
            id: '0s',
            name: 'Lite Gray Sand',
            thumbnail: 'monuvision-assets/images/thumbnail/thumb_lite_gray.png'
        },*/
        roughRock: {
            url: 'monuvision-assets/images/roughRock.jpg',
            id: 'roughRock',
            name: 'Rough Rock',
            thumbnail: null
        }
    };

    icons: { [key: string]: Asset } = {
        bars: {
            url: 'monuvision-assets/icons/bars.png',
            name: 'bars'
        },

        ellipsisH: {
            url: 'monuvision-assets/icons/ellipsis-h.png',
            name: 'ellipsisH'
        },

        replay: {
            url: 'monuvision-assets/icons/replay.png',
            name: 'replay'
        },

        trash: {
            url: 'monuvision-assets/icons/trash.png',
            name: 'trash'
        }
    };

    // TODO: make all paths 1000x1000 for easier (more intuitive) arrangement in complex shapes
    // simple shapes
    paths: { [id: string]: string } = {
        star: 'AABFcIk1B/IAalNIjZj9IFFhPICvkcICuEcIFEBPIjYD9IAaFNg', // test
        // 1000x1000 px rect
        rect: 'EhOHBOIMAAAicPMCcPAAAMAAACcPg',
        // 2100x42.4 px
        grass: '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', // 1000x13.3 px
        baseTopEdge: 'EhOHAA3IEKhtMCTjAAAIEiBtg',

        topRoughEdge:
            'EhNnAElQAxhpCkALQDLAhBtAGQCEALBMh+QCUjrAbghQBzh+B5BYQAmAbCOCvQBCBMCUhMQEiiZBoghQB+gmD2BdQDxBdAsgQQAxgRBzhdQBohYA8gLQF6gFFIAAQKMgLBogxQC1hTA2gLQBugWA2BjQA9BoAbAGQAQAACOg3QBXghAyCaQAmB+BShuQBuiPDrAhQDKAcBuBtQA8A9CJhzQCkiKB5ARQBoAQBtCPQBdBzAWgbQBShjBog8QCkhjB+BYQB+BdDQgRQCvgQBCg3QA3gsCZAcQCqAbBzBjQBoBYAsgWQBBhCBShCQAhgWC1AmQCvAnBjAxQBHAnBHg9QBthdA9gWQBzgmCIBNQB5BBBdByQBCBYAgCUQARBNAAA8MibfAAAIgmAGQgcgLAyhog',

        leftRoughEdge:
            'EAENBNoQk9iABgk6QAuiTgthcQghhEieiVQh/hzBZh5QAbgmCuiOQBNhChNiUQiYkighhoQgnh+Bej2QBdjxgRgsQgQgxhdhzQhYhogLg8QgGl6ABlIQgLqMgxhoQhTi1gLg2QgWhuBjg2QBog9AFgbQAAgQg3iOQgghXCagyQB9gmhuhSQiOhuAhjrQAcjKBthuQA8g8hziJQiJikARh5QAQhoCPhtQBzhdgcgWQhjhSg7hoQhkikBYh+QBeh+gRjQQgQivg3hCQgsg3AbiZQAciqBihzQBYhogVgsQhChBhChSQgWghAmi1QAmivAyhjQAmhHg8hHQhdhtgWg9QgnhzBOiIQBBh5ByhdQBYhCCUggQBNgRA8AAMAAACbfQgBAPgSAIQgMAFgQAAQgiAAg3gWg',

        leftRoughSmoothEdge:
            'EADyBNoQhug2iHupQgzlighlOQgglCAHhUQAFhHgbisIg+lmQhdoSALkUQAhnQAVlLQApp7gXhCQgXhAg8vKQg+vygEgYQgGgsAblDQAdlXAumEQB8whBykZQBMi9CciiQAxgyAygqIApggMAAACbfIAGAmQgEAKgQAAQgcAAhDggg',

        // serp
        tabletSerpRoughTop:
            'EhOGADQIAAgSIAAgdQAFgBBbAGQBrAHBPAAQC4AAELgZIIJgzQEQgYM8hZQbfi/OVAAQPhAAZmDKQMiBjDxAWQDAASFWAjQEfAaDUgBQDUAAAxgDIAAARg',

        tabletSerpRoughTop2:
            'EhOGADjIAAgSIAAgcIAEAAIAHgrICoAQIBdAAIBRgNIB6ANIBmgIIDjgtIEPAIIFEgyIDWgaIC3gJIBkgUIA8gKIBLgKIACAAIBTgUIAmgDIAgADICjgCIA2ghIB3gNICxgFIB3geIEXgaIBlgCIB9ACICGglICCgKIDVABIFCgOIC6AIICSgHIBCAFICTgQIB2AEIDKgPIDaASIBqgJIEQAQQBigEAjAAIFVAEIEJAdQAgABAzgBQAmACAQAOQAQAOA+gDQAigCA+gJICPgBIA4AKQBAAKAnAAQBDAAC1AkICWgXICfAsQAXABAvgDQAqABAdARQAcARA6ABQAfABAtgDIBKAeIB7AVIBlAAIDbAMICHAuIDBAGIB5AcICTADIA6gRIDXAwIBmACIBzAUIDRALIFWAIIApApIAIgBIAAAIIAAAJg',

        tabletSerpTop:
            'EhOGADQIAAgRIAAgdQAFgCBbAGQBrAHBPAAQC4AAELgYIIJg0QEQgYM8hZQbfi/OVAAQPhAAZmDKQMiBjDxAXQDAARFWAjQEfAaDUgBQDUAAAxgCIAAAQg',

        tabletSerpTop2:
            'EhOGADkIAAgRIAAgdIAAgYQAIAABYgUQBlgPBVAAQG/AAJMg1IDugZQBGgJBZgKQC5gUCwgPIXaiYIEZgRIFGgWINSgbIQgAnICiALQA0AFBlAFIaWC+QBXAJBfAMIB0APIDtAbQAVABATACQI/A3H0gBQBqgBCbAoIAAAdIAAABIAAAQg',

        // oval

        tabletOvalRoughTop: 'EhOGAGhIDrhqQGbifIKiKUAZRgGgAgdgAMQBGgCBEAAQBqAABqACQSgALP+CMQLbBjKHCkQMxDRGBDQg',

        tabletOvalRoughTop2:
            'EhOGAHgIAMgGIAUhVIBygSIA3gcIBxgZIA+AJICKgvIBuhrIDchAIEJgdIDWh0IDVg5ID4gYICQgsIA9gzIBKgUIABAAIBSADIAognIAfAIIBtgPIBqAUIB3g1IC8gUICHAhID7hEIBRAUIC3guIBUAOIDqg+IDEATID+gsIC4APICRgNIAfAXICbgqIBtAPIBIgBICAgCIDdAYIAiAEIBOATIAZAkIAggEIDzhAQBggHAjAAIFUAFIEIA+QATABA/gNQAngKAQAaQAEAHABAAQAMARAYADQAQABAegEQAigHA0gPICPgCIA3AWQBAAUAoAAQBCAACuAeICfAPIA6ATIBiAdQA5AFBMAaQAeANA9gDIBNgCIBKAyIBwAKIB3A7IDbACIB+A1IDDAPIDbBXIAWAOIARgDIB+AZIAxAAIBLAcIBfA4IB5AIICUAbICNBWIC3AaQCDCTAJAEg',

        tabletOvalTop: 'EAl0AGhMhz6AAAQI8kROdjQQYMlgeXAAQUfAARfCZQLZBkKGCkQMyDPGDDRg',

        tabletOvalTop2: 'EAl0AG3Mhz6AAAQAMgSA3gfQAcgQAVgIQJNkKM8i9QXpldd7AAQU1AARkCaQKpBdJdCXQMhDFF0DIIAyAkQA1AkASAKg',

        // exaggerated serp

        tabletExSerpRoughTop:
            'EAl0AGfMhz6AAAIABgRIAHAAIAfAAQGvgKHQhMQCDgWCHgbQEUg3NPjYQLbi6IGhUQGnhIG1ghQBBgEBBgEQBvgIBwgFQCtgJCrgBIAHAAIAEAAIACAAQEhADEaAUQBBAEBAAEQGzAhGoBIQB5ATCGAaQDXApD3A4QD6A4EaBIQKxCwE3BFIBYATIAkAHIALADQAJAAALAEIAIABIAIACIAIABIAHABIAIABIEJAvIARACIAEAAIAEABIADABIDDAbIB8AMIAzAGICRALIASACIAbADIAAAbg',

        tabletExSerpRoughTop2:
            'EAl0AHQMhz6AAAIABgSIAHAAIAfAAIA+gCIhiAAIBshcIgEgFIBSgUIBdgDIB1gHIBWAHIBmgQIDbgiIEXgoIFihWIDWg1IC4gTIBkgoIA8gVIBLgTIABAAIBTgoIAmgHIAgAHICkgGIA1hBIB4gNIB9hCICMgiIEXgmIBlAGICmgtIBdgjICCgcIDWAEIFBglIC6APICSgqIAeAVICbgbIBuADIDJggIDiAwICAgIIEYgIQAmgDAsAIIAyAJIE3AJICbAyIBrAKQBfAHAVAAQAlAEASAbQAHAOAQAFQAOAEAQABQAKAAAOgCQAggEBAgRICQAGIA3AUQBAATAoAAQBCAACvAqICfAUIBIAYIBVAcQA/AGBHAYQAhAOA6ALQAuAJAgACIBKA9IBmgMIB6A4IDaAWICIBdIDAAMIB6A6ICSAFIAxgCIDgBBIBnAFIBzAoIDQAXIFWAPIAhBOIAFAAIAAAdg',

        tabletExSerpTop:
            'EAl0AGhMhz6AAAIABgRIAHAAIAfAAQGvgLHQhMQCDgVCHgcQEUg3NPjZQLbi6IGhWQGnhHG1ghQBBgFBBgEQBvgIBwgFQCtgICrgCIAHAAIAEAAIACAAQEhAEEaATQBBAEBAAFQGzAhGoBHQB5AUCGAaQDXApD3A4QD6A5EaBIQKxCwE3BGIBYATIAkAHIALADQAJABALACIAIACIAIACIAIAAIAHADIAIAAIEJAvIARADIAEAAIAEAAIADABIDDAbIB8ANIAzAFICRAMIASACIAbACIAAAcg',

        tabletExSerpTop2:
            'EAl0AG9Mhz6AAAIABgRIgBgHIBbguIAnAAQDMgFC/gWQB8gOC7gfIBigQQCugeBcgUQErg+M4jXQJ2iiJrhoQG0hJGoghICCgJQB3gIBogFQDCgKCWAAIANAAQErAEEQATICBAJQGnAhG0BJQCIAXB3AYQETA2C7AoIAGABQEUA8D6BAQKyC1E2BGIDCAnIEeAyIDKAdQArAGBRAHIAzAGQAyAFCMALIAABRg',

        // half serp
        tabletHalfSerpRoughTop: 'EBKeADQIiKAAMgigAAAMhz6gABIAAgFQLbgEPQgZQeigxTThoQTmhoT0g5QIrgaItgQQJ6gSHOgFICKgBIDqAAIAAGfg',

        tabletHalfSerpRoughTop2:
            'EhNkAEJQAggIASgBIB7gaQCGAOCkgRIBZgNQAzgJAzgBQAfAABFAOQBEAMAlAAID3gvIC6gIICCAKICrgPIEwAWQArgCBngVQBmgWArgDQAWgBBfAbQBCASAQghQAOgfBWAEICWAHQAZgBBdgeQBKgVAtANQAQAFBRADQBXAEA2gFQAUgBBWgMQBCgJAnACQB5AEAkAIQAnAHAggTQAngWANgBQAzgFBlAKQBkANAzgGQBhgLAgASQAdARBYgNQAngFCrgNQCygMAgABQAjABBAgdQBHggAfgFQAigEBKAEQBFADAdgGQA0gJBQARQBHAOAigNQAfgNA/gEQBIgEAsgLQAogMBpgUQB0gWAfAAQC4ADDoggQBSgLBVgEQBzgFAeALQBEAbB8gbQCGgeAgAHQAbAGBUgNQBVgNAGAAQBBAKBWAFQBcAEA6gFIA/gGQBDgIBagNQB2gKB1AgQAkAKBGgeQBTgjAbgDQBGgFBiADICiAFQA0ABCLgkQBxggA/AWQA7AVBagIQAwgFBagMQAggBBFAaQA/AZAfgEQAagEBFgPQA4gLAfgBQBXgDBcAPIA6AJIBFAKQAdACAoAFQBGAIBoAQIAhAqIAcAAIAAGbIjqAAIiJAAMgigAAAMhq6gABIo0ALg',

        tabletHalfSerpTop: 'EBKeADQIiKAAMgigAAAMhz6gABIAAgFQLbgEPQgZQeigxTThoQTmhoT0g6QIrgZItgRQJ6gSHOgEICKgBIDqAAIAAGfg',

        tabletHalfSerpTop2:
            'EBKeADnIiKAAMgigAAAMhz6gACIAAgFIADAAIC/g6QIBgCE4gDQHugIG3gOQRcgoIBgYQPRgsHMguQIGg0J3gnQIPgiLUgfIHFgVQEOgMDDgGQGYgNHBgDQD0gDHSgBIBfAtIAAGgg',

        // test:
        tabletCenter: 'EglVAShMAAAglBMBKrAAAMAAAAlBg',

        tabletTopEdge: 'EglVACsIAAi8IAugIQAxgHAoAAQDWAAEZgWQB1gJGZgnQLehGICAAQIkAAKxBLQF1AoB+ALQETAXDvgBQAzAABKARIAACyg',

        tabletTopEdge2:
            'AfrBPIkAgWQhzgJmAgpQsPhTnaAAQm2AAtIBOQmNAliBAKIj5AVQiAALhYAAQglAAg0gDIgugCIAAgKIAugIQAxgHAoAAQDWAAEZgWIC+gSQCwgRCggMQG7gkDzgPQFHgTDrAAQEGAAFAAUQEeASFxAlQCDAMC0ATQCVAQAnADQETAXDvgBQAzAABKARIAAAMQgYABhlAAIgJAAQhiAAiDgKg',

        baseCenter: 'EgqUAHLIAAuVMBUpAAAIAAOVg',

        baseLeftEdge:
            'AAbHGQgKgFABgPIAEgcQABgMgMgHIgXgQQgMgLAIgLQADgDAPgNQAHgGgHgOQgNgagDgKQgEgLAJgXQAIgWgBgEQgCgEgIgLQgIgJgBgGIgBhAQgBg8gEgJQgIgRgBgFQgCgKAJgFQAKgFAAgDIgFgNQgDgIAOgFQAMgDgKgIQgNgKADgVQACgTAKgKQAGgFgLgNQgMgPABgLQACgJANgKQAKgJgCgCQgJgHgGgKQgJgPAIgLQAJgMgCgTQgBgQgFgGQgEgFACgOQADgPAJgLQAHgJgBgEIgMgOQgCgDADgQQAEgQAEgJQAEgHgGgGQgIgKgCgGQgEgKAHgNQAGgLAKgIQAIgGANgDIANgCIAAOMIAAAEIgCABQgCAAgGgDg'
    };

    // Sub shapes (simple shapes) must have rotation === 0;
    // Generally use pitch: true for rough surfaces and gradient: true for smooth surfaces
    // Order may be important, e.g. before a shape with roughtRock:true usually should go same shape but with pitch: true instead of roughRock:true;
    // Central sub shapes usually are 1000x1000px;
    // To make complexShapes more compact tablet shapes (e.g. serp) includes shapes for different polishes (e.g. P2,P3,P5) - the shape service
    // automatically deletes unused;
    complexShapes: { [key: string]: ShapeModel[] } = {
        // base PT
        baseP1: [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.6,
                scaleY: 0.15,
                rotation: 0,
                shape: 'rect',
                place: 'c',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.6,
                scaleY: 0.15,
                rotation: 0,
                shape: 'rect',
                place: 'c',
                roughRock: true
            },
            {
                type: 'shape',
                x: 0,
                y: -499, // not using 500px because of a possible 1px white line
                scaleX: 0.6,
                scaleY: 1,
                rotation: 0,
                shape: 'baseTopEdge',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.1,
                scaleY: -0.15,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.1,
                scaleY: -0.15,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // base P5
        baseP5: [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.6,
                scaleY: 0.15,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.6,
                scaleY: 1,
                rotation: 0,
                shape: 'baseTopEdge',
                place: 't',
                gradient: true
            }
        ],

        // base MGN
        baseP6: [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.6,
                scaleY: 0.15 * 0.75,
                rotation: 0,
                shape: 'rect',
                place: 'c',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.6,
                scaleY: 0.15 * 0.75,
                rotation: 0,
                shape: 'rect',
                place: 'c',
                roughRock: true
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.6,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 2) / 1000, //0.15 * 0.25,
                rotation: 0,
                shape: 'rect',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                pivotX: 0,
                pivotY: 266 / MeasurementService.SCALE,
                scaleX: 0.6,
                scaleY: 1,
                rotation: 0,
                shape: 'baseTopEdge',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.1,
                scaleY: -0.15 * 0.75,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.1,
                scaleY: -0.15 * 0.75,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // base PT (top view)
        baseTVP1: [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.6,
                scaleY: 0.15,
                rotation: 0,
                shape: 'rect',
                place: 'c',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -499, // not using 500px because of a possible 1px white line
                scaleX: 0.6,
                scaleY: 0.15,
                rotation: 0,
                shape: 'topRoughEdge',
                place: 't',
                frost: true
            },
            {
                type: 'shape',
                x: 0,
                y: 499, // not using 500px because of a possible 1px white line
                scaleX: 0.6,
                scaleY: -0.15,
                rotation: 0,
                shape: 'topRoughEdge',
                place: 'b',
                frost: true
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.1,
                scaleY: -0.15,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                frost: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.1,
                scaleY: -0.15,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                frost: true
            }
        ],

        // base P5 (top view)
        baseTVP5: [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.6,
                scaleY: 0.15 * 0.75,
                rotation: 0,
                shape: 'rect',
                place: 'c',
                pitch: true
            }
        ],

        // base MGN (top view)
        baseTV6: [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.6,
                scaleY: 0.15 * 0.75,
                rotation: 0,
                shape: 'rect',
                place: 'c',
                pitch: true
            }
        ],

        // serp (includes shapes for P2,P3,P5 - just automatically delete unused)
        '1': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54, // can be any value, but set something easy to correlate 540px (36 inches - default tablet width)
                scaleY: 0.36, // can be any value, but set something easy to correlate 360px (24 inches - default tablet height)
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499, // to avoid the white 1px line bug - you may use -499 for lower shapes with pitching and -498 similar upper shapes wihout pitcing)
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // exaggerated serp
        '2': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletExSerpTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletExSerpTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletExSerpRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletExSerpRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // straight
        '3': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.09,
                rotation: 0,
                shape: 'topRoughEdge',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.375,
                rotation: 0,
                shape: 'baseTopEdge',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // oval
        '4': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // half serp right
        '5': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: -0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletHalfSerpTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: -0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletHalfSerpTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: -0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletHalfSerpRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: -0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletHalfSerpRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: -499,
                y: -499,
                scaleX: 0.05,
                scaleY: 0.02,
                rotation: 0,
                shape: 'leftRoughSmoothEdge',
                place: 'tl',
                pitch: true
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // half serp left
        '6': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletHalfSerpTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletHalfSerpTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletHalfSerpRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletHalfSerpRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 499,
                y: -499,
                scaleX: -0.05,
                scaleY: 0.024,
                rotation: 0,
                shape: 'leftRoughSmoothEdge',
                place: 'tr',
                pitch: true
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // flat marker
        '17': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            }
        ],

        // bevel marker
        '18': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            }
        ],

        // slant straight marker
        '19': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.09,
                rotation: 0,
                shape: 'topRoughEdge',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.375,
                rotation: 0,
                shape: 'baseTopEdge',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: -0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: -0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: 499,
                scaleX: 0.54,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'rect',
                place: 'b',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: 499,
                scaleX: 0.54,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'rect',
                place: 'b',
                roughRock: true
            },
            {
                type: 'shape',
                x: -499,
                y: 499,
                scaleX: 0.09,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'leftRoughSmoothEdge',
                place: 'bl',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 499,
                scaleX: -0.09,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'leftRoughSmoothEdge',
                place: 'br',
                pitch: true
            }
        ],

        // slant serp marker
        '20': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: -0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: -0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: 499,
                scaleX: 0.54,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'rect',
                place: 'b',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: 499,
                scaleX: 0.54,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'rect',
                place: 'b',
                roughRock: true
            },
            {
                type: 'shape',
                x: -499,
                y: 499,
                scaleX: 0.09,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'leftRoughSmoothEdge',
                place: 'bl',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 499,
                scaleX: -0.09,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'leftRoughSmoothEdge',
                place: 'br',
                pitch: true
            }
        ],

        // slant oval marker
        '21': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: -0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: -0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: 499,
                scaleX: 0.54,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'rect',
                place: 'b',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: 499,
                scaleX: 0.54,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'rect',
                place: 'b',
                roughRock: true
            },
            {
                type: 'shape',
                x: -499,
                y: 499,
                scaleX: 0.09,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'leftRoughSmoothEdge',
                place: 'bl',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 499,
                scaleX: -0.09,
                scaleY: (MeasurementService.LEGACY_PIXELS_PER_INCH * 3) / 1000,
                rotation: 0,
                shape: 'leftRoughSmoothEdge',
                place: 'br',
                pitch: true
            }
        ],

        // straight
        '22': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.09,
                rotation: 0,
                shape: 'topRoughEdge',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.5,
                rotation: 0,
                shape: 'baseTopEdge',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // western slant serp marker
        '23': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletSerpRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ],

        // western slant oval marker
        '24': [
            {
                type: 'shape',
                x: 0,
                y: 0,
                scaleX: 0.54,
                scaleY: 0.36,
                rotation: 0,
                shape: 'rect',
                place: 'c'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalTop2',
                place: 't',
                gradient: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalTop',
                place: 't'
            },
            {
                type: 'shape',
                x: 0,
                y: -499,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalRoughTop2',
                place: 't',
                pitch: true
            },
            {
                type: 'shape',
                x: 0,
                y: -498,
                scaleX: 0.54,
                scaleY: 0.54,
                rotation: 0,
                shape: 'tabletOvalRoughTop',
                place: 't'
            },
            {
                type: 'shape',
                x: -499,
                y: 0,
                scaleX: 0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'l',
                pitch: true
            },
            {
                type: 'shape',
                x: 499,
                y: 0,
                scaleX: -0.09,
                scaleY: 0.36,
                rotation: 0,
                shape: 'leftRoughEdge',
                place: 'r',
                pitch: true
            }
        ]
    };

    sinkageColors: { [key: string]: ColorItem } = {
        black: {
            id: 'black',
            name: 'Black',
            hex: 0x000000
        },
        gray: {
            id: 'gray',
            name: 'Gray',
            hex: 0x5a5a5a,
            alpha: 0.55
        },
        gold: {
            id: 'gold',
            name: 'Gold',
            hex: 0xd1a81b,
            shadowHex: 0x5d5a0a
        },
        silver: {
            id: 'silver',
            name: 'Silver',
            hex: 0xd9d9f3,
            shadowHex: 0x696983
        },
        white: {
            id: 'white',
            name: 'White',
            hex: 0xffffff,
            shadowAlpha: 0.3
        }
    };

    defaultVertexSrc = `
        precision highp float;

        attribute vec2 aVertexPosition;
        attribute vec2 aUvs;

        uniform mat3 translationMatrix;
        uniform mat3 projectionMatrix;

        varying vec2 vUvs;

        void main() {

            vUvs = aUvs;
            gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);

        }
    `;

    frameBorderFragmentSrc = `
        precision highp float;

        varying vec2 vUvs;

        uniform sampler2D uSampler2;
        uniform float left;
        uniform float right;
        uniform float top;
        uniform float bottom;
        uniform float scaleX;
        uniform float scaleY;

        void main() {

            float xL = min(0.495, left/scaleX);
            float xR = min(0.495, right/scaleX);
            float yT = min(0.495, top/scaleY);
            float yB = min(0.495, bottom/scaleY);

            // internal part scale
            float isx = (1.0 - xL - xR)/(1.0 - (xL + xR)*scaleX);
            float isy = (1.0 - yT - yB)/(1.0 - (yT + yB)*scaleY);
           
            vec2 coord = vUvs.xy;

            if(vUvs.x <= xL){
                coord.x*= scaleX;
            }else{
                if(vUvs.x >= (1.0 - xR)){
                    coord.x = 1.0 - (1.0 - coord.x)*scaleX;
                }else{
                   coord.x = 0.5 - (0.5 - coord.x)/isx;  
                }
            }
            if(vUvs.y <= yT){
                coord.y*= scaleY;
            }else{
                if(vUvs.y >= (1.0 - yB)){
                    coord.y = 1.0 - (1. - coord.y)*scaleY;
                }else{
                    coord.y = 0.5 - (0.5 - coord.y)/isy;
                }
            }

            gl_FragColor = texture2D(uSampler2, coord);
        }
    `;

    pixelData: { [key: string]: PixelData } = {};

    renderer: PIXI.Renderer;

    es: ExportService;

    constructor(private ngZone: NgZone, private config: ConfigService, private http: HttpClient, private msgService: MessageService) {}

    init() {
        let promises: Promise<any>[] = [];

        promises.push(
            this.getColors()
                .then((res) => {
                    this.initBitmapFills(res);
                })
                .catch((err) => {
                    this.msgService.add({ severity: 'error', summary: 'Materials Not Found', detail: 'Please upload some materials.' });
                })
        );

        return Promise.all(promises)
            .then(() => {
                this.initSinkageColors();
            })
            .catch((err) => {
                console.warn("Can't load assets");
            });
    }

    private initBitmapFills(colors: DesignDataColor[]) {
        colors.sort(this.compareColor);

        AssetService.DEFAULT_BITMAP_FILL_ID = colors[0].id;

        colors.forEach((data) => {
            let id: string = data.id;
            this.bitmapFills[id] = {
                url: this.config.getAssetFullURL(data.darkImage, true),
                id: id,
                name: data.name,
                thumbnail: data.thumbnail,
                sortVal: data.sortVal
            };
        });

        colors.forEach((data) => {
            let id: string = data.id + 's';
            this.bitmapFills[id] = {
                url: this.config.getAssetFullURL(data.lightImage, true),
                id: id,
                name: data.name + ' Sand',
                thumbnail: null,
                sortVal: data.sortVal
            };
        });

        colors.forEach((data) => {
            let id: string = data.id + 'p';
            this.bitmapFills[id] = {
                url: this.config.getAssetFullURL(data.pitchingImage, true),
                id: id,
                name: data.name + ' Pitch',
                thumbnail: null,
                sortVal: data.sortVal
            };
        });

        Object.keys(this.bitmapFills).forEach((key) => {
            let bf: BitmapFillItem = this.bitmapFills[key];
            if (bf.id !== key) {
                console.warn('ID mismatch', key, bf.id);
            }
            // save pixels of regular and pitched texture only
            let isTextureToSave: boolean = bf.id.search(/[s]/i) === -1;
            let url: string = this.config.getAssetFullURL(bf.thumbnail || bf.url, true);
            let urlFull: string = this.config.getAssetFullURL(bf.url, true);
            let texture: PIXI.Texture = PIXI.Texture.from(url);

            let onTextureLoadComplete: Function = () => {
                this.setUpTexture(PIXI.Texture.from(urlFull));

                // save brightness (using the thumbnail to do it faster)
                if (isTextureToSave) {
                    this.ngZone.run(() => {
                        bf.brightness = this.savePixelData(texture, url, true).avgBrightness;
                        // copy pixel data from the thumbnail to the full image
                        if (urlFull !== url) {
                            this.pixelData[urlFull] = _.clone(this.pixelData[url]);
                        }
                    });
                }
            };

            if (!texture.baseTexture.valid && isTextureToSave) {
                texture.once('update', onTextureLoadComplete);
            } else {
                onTextureLoadComplete();
            }
        });
    }

    // works even for not preloaded textures
    setUpTexture = (texture: PIXI.Texture) => {
        // mipmap should be OFF for Pixi version < 5.2 (otherwise wrapMode 'repeated' may look bad in filters)
        texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
        texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        //texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; // pixelated
        texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; // smooth
    };

    private initSinkageColors() {
        // colors
        // cache color textures
        Object.keys(this.sinkageColors).forEach((key) => {
            let color: ColorItem = this.sinkageColors[key];

            if (isNaN(color.alpha)) {
                color.alpha = 1.0;
            }

            if (isNaN(color.shadowHex)) {
                color.shadowHex = 0x000000;
            }

            if (isNaN(color.shadowAlpha)) {
                color.shadowAlpha = 0.5;
            }

            let g: PIXI.Graphics = new PIXI.Graphics();
            g.beginFill(color.hex, color.alpha).drawRect(0, 0, 64, 64).endFill();

            let brt: PIXI.BaseRenderTexture = new PIXI.BaseRenderTexture({
                width: g.width,
                height: g.height,
                scaleMode: PIXI.SCALE_MODES.LINEAR,
                resolution: 1
            });
            brt.wrapMode = PIXI.WRAP_MODES.REPEAT;

            // must have separate RenderTexture instances for each renderer
            let rt: PIXI.RenderTexture = new PIXI.RenderTexture(brt);
            let rtExport: PIXI.RenderTexture = new PIXI.RenderTexture(brt);

            this.renderer.render(g, rt, false);
            if (this.es.exportRenderer) {
                this.es.exportRenderer.render(g, rtExport, false);
            } else {
                rtExport = rt;
            }

            color.getRT = () => {
                return this.es.showExportInfo ? rtExport : rt;
            };

            color.brightness = ColorUtils.getColorBrightness(color.hex);

            if (color.id !== key) {
                console.warn('ID mismatch', key, color.id);
            }
        });
    }

    private getColors(noCache: boolean = false): Promise<DesignDataColor[]> {
        let suffix: string = noCache ? '?random=' + Math.random() * 10000 : '';
        let promises: Promise<any>[] = [];
        let colors: DesignDataColor[] = [];
        let url: string =
            this.config.testMode.indexOf('color') >= 0
                ? this.config.assetsURL + 'test/materials.json'
                : this.config.apiURL + 'materials' + suffix;
        promises.push(this.http.get<any>(url, { responseType: 'json' }).toPromise());

        return Promise.all(promises).then((results) => {
            results.forEach((res, index) => {
                if (res) {
                    let resArr: any[] = res instanceof Array ? res : [res];

                    resArr = resArr.map((element) => {
                        return {
                            name: String(element.name),
                            type: String(element.type), // deprecated
                            id: String(element.id),
                            darkImage: String(element.dark_image),
                            lightImage: String(element.light_image),
                            pitchingImage: String(element.pitching_image),
                            thumbnail: String(element.thumbnail || element.dark_image),
                            sortVal: element.sort ? parseInt(element.sort) : 0
                        };
                    });

                    colors = colors.concat(resArr);
                }
            });

            if (this.config.testMode.indexOf('color') >= 0) {
                //colors.splice(8);
                let colorsCopy: DesignDataColor[] = colors.concat();
                for (let i = 0; i < 0; i++) {
                    // flood by clones
                    colors = colors.concat(
                        colorsCopy.map((elem) => {
                            let copy = _.cloneDeep(elem);
                            copy.id = String(Math.floor(Math.random() * 10000000));
                            copy.name = 'Clone';

                            return copy;
                        })
                    );
                }
            }

            return colors;
        });
    }

    compareColor(a: DesignDataColor | BitmapFillItem, b: DesignDataColor | BitmapFillItem) {
        if (a.sortVal > b.sortVal) {
            return 1;
        } else {
            if (a.sortVal < b.sortVal) {
                return -1;
            }

            return 0;
        }
    }

    savePixelData = (texture: PIXI.Texture, id: string, quickMode?: boolean, pixels?: Uint8ClampedArray) => {
        if (!this.pixelData[id]) {
            let minBr: number = 1.0;
            let maxBr: number = 0.0;
            let avgBr: number = 0.0;
            let counter: number = 0;
            let found: boolean = false;
            let arr: Uint8ClampedArray = pixels || this.getImageData(texture.baseTexture).data;
            if (arr) {
                // in the quick mode skip some pixels to make calculation faster (for images bigger than 128x128 )
                let skipPixels: number = quickMode ? Math.floor(arr.length / 16384) : 0;
                let step: number = 4 * (skipPixels + 1);
                for (let i: number = 0; i < arr.length; i += step) {
                    let alpha: number = arr[i + 3];

                    // search among valuable pixels (cut off almost invisible pixels)
                    if (alpha > 64) {
                        found = true;
                        let rgb: number[] = [arr[i] / 255, arr[i + 1] / 255, arr[i + 2] / 255];
                        let br: number = ColorUtils.getColorBrightness(rgb);
                        if (br < minBr) {
                            minBr = br;
                        }
                        if (br > maxBr) {
                            maxBr = br;
                        }
                        avgBr += br;
                        counter++;
                    }
                }

                avgBr /= counter;
            }

            if (!found) {
                minBr = 0;
                maxBr = 1;
            }

            this.pixelData[id] = {
                id: id,
                minBrightness: Math.round(minBr * 1000) / 1000,
                maxBrightness: Math.round(maxBr * 1000) / 1000,
                avgBrightness: Math.round(avgBr * 1000) / 1000
            };
        }

        return this.pixelData[id];
    };

    getPixelData(id: string) {
        return this.pixelData[id];
    }

    // Returns the image data, 'data' property of which contains 1-dimensional array containing the data in the RGBA order.
    // Don't use renderer.plugins.extract.pixels() cause it's buggy and may produce awkward results (empty pixel clasters),
    // also it seems slightly slower
    getImageData(baseTexture: PIXI.BaseTexture) {
        let imageData: ImageData;
        if (!baseTexture.resource) {
            return imageData;
        }
        const imgSource: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | SVGElement = (baseTexture.resource as any).source;
        let canvas: HTMLCanvasElement = null;
        if (!imgSource) {
            return imageData;
        }

        let context: CanvasRenderingContext2D = null;
        if ((imgSource as any).getContext) {
            canvas = imgSource as HTMLCanvasElement;
            context = canvas.getContext('2d');
        } else if (imgSource instanceof Image) {
            canvas = document.createElement('canvas');
            canvas.width = imgSource.width;
            canvas.height = imgSource.height;
            context = canvas.getContext('2d');
            context.drawImage(imgSource, 0, 0);
        } else {
            return imageData;
        }

        const w = canvas.width,
            h = canvas.height;

        imageData = context.getImageData(0, 0, w, h);
        return imageData;
    }

    // Returns pixels as a structured few-dimensional array (debug purposes only at the moment)
    getPixels(texture: PIXI.Texture) {
        const width: number = texture.orig.width;
        const baseTexture: PIXI.BaseTexture = texture.baseTexture;

        const newArr: number[][][] = [];
        const imageData: ImageData = this.getImageData(baseTexture);
        if (!imageData) {
            return newArr;
        }
        const data: Uint8ClampedArray = imageData.data;

        let count: number = 0;
        let tmpArr: number[] = [];
        let lineArr: number[][] = [];
        for (let i = 0, len = data.length; i <= len; i++) {
            if (count > 3) {
                lineArr.push(tmpArr);
                tmpArr = [];
                count = 0;
            }
            if (lineArr.length === width) {
                newArr.push(lineArr);
                lineArr = [];
            }
            tmpArr.push(data[i]);
            count++;
        }

        return newArr;
    }
}
