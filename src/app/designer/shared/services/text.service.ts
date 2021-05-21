import { Injectable, EventEmitter } from '@angular/core';
import { TextModel, DesignText, FontItem, DataEvent, ColorItem } from '../models/main';
import { MeasurementService } from './measurement.service';
import Quill from 'quill';
import * as OpenType from 'opentype.js';
import * as FontFaceObserver from 'fontfaceobserver';
import * as PIXI from 'pixi.js';
import * as _ from 'lodash';
import { OutlineFilter } from '@pixi/filter-outline';
import { TextInput } from '../../pixi/text-input';
import { StrUtils } from '../utils/str-utils';
import { ConvexCavityFilter } from '../../pixi/filters/convex-cavity-filter';
import { TransformTool } from '../../pixi/transform-tool';
import { AssetService } from './asset.service';
import { ConfigService } from './config.service';
import { HttpClient } from '@angular/common/http';
import { GeomUtils } from '../utils/geom-utils';

export class TextServiceEventType {
    static EVENT_TEXT_EDIT_START: string = 'eTextEditStart';

    static EVENT_TEXT_EDIT_STOP: string = 'eTextEditStop';

    static EVENT_TEXT_INPUT: string = 'eTextInput';
}
@Injectable({
    providedIn: 'root'
})
export class TextService extends EventEmitter<any> {
    static DEFAULT_FONT_ID: number = 1;

    static DEFAULT_FONT_SIZE: number = 3;

    protected static readonly DEFAULT_TEXT_MODEL: TextModel = {
        type: 'text',
        x: 5,
        y: 5,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        string: '',
        font: '0,1',
        size: '0,3',
        lineSpacing: '0.5',
        spacing: 0.125,
        bold: false,
        vCut: false,
        polish: false,
        frost: false,
        outline: false,
        justify: 1,
        shapeEnabled: false,
        shapeAdjust: 0.75,
        sinkage: 'gray',
        lowerBitmapFill: AssetService.DEFAULT_BITMAP_FILL_ID,
        numLetters: 0
    };

    static readonly MODEL_UNIT_SIMPLE_PROPS: string[] = ['x', 'y', 'spacing']; // support direct conversion

    static readonly MODEL_UNIT_SPECIAL_PROPS: string[] = ['size', 'lineSpacing'];

    fonts: FontItem[] = [
        { id: 1000, url: 'monuvision-assets/fonts/Dosis-Bold.woff' },
        { id: 2000, url: 'monuvision-assets/fonts/open-sans-v15-latin-regular.woff' }
    ];

    container: PIXI.Container;

    tt: TransformTool;

    outlineWidthInch: number = 0.2;

    shadowDistanceInch: number = 0.13333;

    filterOutline: OutlineFilter = new OutlineFilter(
        Math.round(MeasurementService.inchToPx(this.outlineWidthInch) * 10) / 10,
        0x000000,
        0.5
    );

    selectedInput: DesignText;

    editableInput: DesignText;

    constructor(private config: ConfigService, private http: HttpClient, private as: AssetService) {
        super();
    }

    static createTextModel() {
        let m: TextModel = _.cloneDeep(TextService.DEFAULT_TEXT_MODEL);
        m.font = '0,' + TextService.DEFAULT_FONT_ID;
        m.size = '0,' + TextService.DEFAULT_FONT_SIZE;
        m.lowerBitmapFill = AssetService.DEFAULT_BITMAP_FILL_ID;
        let currentUnit: string = MeasurementService.CURRENT_UNIT;
        let targetUnit: string = MeasurementService.INCH;
        m = MeasurementService.convertPropsToUnit(m, TextService.MODEL_UNIT_SIMPLE_PROPS, currentUnit, targetUnit);

        // convert special properties
        if (currentUnit !== targetUnit) {
            m.size = m.size
                .split('|')
                .map((elem) => {
                    let arr: string[] = elem.split(',');
                    return arr[0] + ',' + MeasurementService.convertToUnit(arr[1], currentUnit, targetUnit);
                })
                .join('|');
            m.lineSpacing = m.lineSpacing
                .split(',')
                .map((elem) => MeasurementService.convertToUnit(elem, currentUnit, targetUnit))
                .join(',');
        }

        return m;
    }

    init() {
        // text editor

        // default attributes
        let FontAttributor: any = Quill.import('attributors/style/font');
        FontAttributor.whitelist = null; // allow any values
        Quill.register(FontAttributor, true);

        let SizeAttributor: any = Quill.import('attributors/style/size');
        SizeAttributor.whitelist = null; // allow any values
        Quill.register(SizeAttributor, true);

        // custom attributes
        let Parchment: any = Quill.import('parchment');
        let lineHeightConfig: any = {
            scope: Parchment.Scope.BLOCK, //INLINE
            whitelist: null
        };
        let lineHeightStyle = new Parchment.Attributor.Style('lineHeight', 'line-height', lineHeightConfig);
        Parchment.register(lineHeightStyle);

        let topConfig: any = {
            scope: Parchment.Scope.BLOCK,
            whitelist: null
        };
        let topStyle = new Parchment.Attributor.Style('marginTop', 'margin-top', topConfig);
        Parchment.register(topStyle);

        let fsConfig: any = {
            scope: Parchment.Scope.BLOCK,
            whitelist: null
        };
        let fsStyle = new Parchment.Attributor.Style('fontSize', 'font-size', fsConfig);
        Parchment.register(fsStyle);

        return this.loadFonts();
    }

    protected loadFonts() {
        let url: string =
            this.config.testMode.indexOf('font') >= 0 ? this.config.assetsURL + 'test/fonts.json' : this.config.apiURL + 'fonts';
        return this.http
            .get<any[]>(url)
            .toPromise()
            .then((result) => {
                if (result && result.length > 0) {
                    this.fonts = [];
                    result.forEach((data) => {
                        let fi: FontItem = {
                            id: data.id,
                            fontFamilyAlias: data.name,
                            url: this.config.getAssetFullURL(data.file, true),
                            scale: data.scale,
                            lineScale: data.line_scale,
                            dropdownScale: data.dropdown_scale || 1.0,
                            sizes: (data.sizes as string).split(',').map((elem) => {
                                return { label: elem + '"', value: parseFloat(elem) };
                            }),
                            useCaps: data.use_caps,
                            sandedCenter: data.sanded_center,
                            sortVal: data.sort ? parseInt(data.sort) : 0
                        };

                        this.fonts.push(fi);

                        if (fi.sandedCenter) {
                            // add a hidden font needed to create Sanded Center (Frost) effect
                            let fiClone: FontItem = _.cloneDeep(fi);
                            fiClone.id = fiClone.id + 10000000;
                            fiClone.fontFamilyAlias += ' Sand';
                            fiClone.hidden = true;
                            fiClone.originalFontItem = fi;
                            this.fonts.push(fiClone);
                        }
                    });
                }

                this.fonts.sort((a, b) => a.sortVal - b.sortVal);

                if (this.fonts.length > 0) {
                    let defFont: FontItem = this.fonts[0];
                    TextService.DEFAULT_FONT_ID = defFont.id;
                    TextService.DEFAULT_FONT_SIZE = defFont.sizes[Math.floor((defFont.sizes.length - 1) / 3)].value;
                }

                // load font files
                let fontPromises: Promise<void>[] = [];
                this.fonts.forEach((f) => {
                    fontPromises.push(this.loadFontItem(f));
                });

                return new Promise<any>((resolve, reject) => {
                    Promise.all(fontPromises)
                        .then(() => {
                            // all the font files are loaded (except ones which failed to be loaded/modified)

                            if (this.config.testMode.indexOf('font') >= 0) {
                                console.log('Fonts loaded');
                            }

                            this.appendFontFaces();
                            this.appendFontDummyDivs();

                            // check for the font faces to be ready
                            let fontFaceObservers: Promise<void>[] = [];
                            // TODO: consider removing FontFaceObserver (it is too buggy without dummy divs and not used at the moment)
                            this.fonts.forEach((f) => {
                                if (this.isBlobFontItem(f)) {
                                    // no need to observe Blob fonts
                                    // (also for some TTF / OTF fonts errors may present during loading by FontFaceObserver)
                                    fontFaceObservers.push(Promise.resolve());
                                } else {
                                    let obs: FontFaceObserver = new FontFaceObserver(f.fontFamily);
                                    // load a font face
                                    fontFaceObservers.push(obs.load('Hello', 8000));
                                }
                            });

                            // extra check for the font facesto be ready
                            // TODO: add better mechanism to detect if fonts are loaded (and remove the simple delay below),
                            // it will be highly required if text created immediately after the app initialization
                            let browserName: string = this.config.userAgent.browser.name.toLowerCase();
                            let isSafari: boolean = browserName.indexOf('safari') >= 0;
                            // this API is experimental and not really supported by some browsers/devices though available
                            let cssFontLoadingAPISupported: boolean = this.config.isDesktop && !isSafari;

                            fontFaceObservers.push((document as any).fonts.ready);

                            // add a simple delay just in case the API is not working properly
                            fontFaceObservers.push(
                                new Promise((resolve) => {
                                    setTimeout(resolve, cssFontLoadingAPISupported ? 200 : 1500);
                                })
                            );

                            Promise.all(fontFaceObservers)
                                .then((loadedFonts) => {
                                    // all the font faces are available
                                    if (this.config.testMode.indexOf('font') >= 0) {
                                        let ready: boolean = (document as any).fonts.check('12px ' + this.fonts[0].fontFamily);
                                        console.log(`Font ${this.fonts[0].fontFamily} is ready: ${ready}`);
                                    }
                                    resolve(true);
                                })
                                .catch((err) => {
                                    console.warn('Some critical font faces are not available:', err);
                                    reject();
                                });
                        })
                        .catch((err) => {
                            console.warn('Some font files are not available:', err);
                            reject();
                        });
                });
            });
    }

    protected loadFontItem(f: FontItem) {
        return new Promise<void>((resolve, reject) => {
            OpenType.load(f.url, (error: any, loadedFont: OpenType.Font) => {
                // implicitly define format
                f.format = StrUtils.getExtension(f.url);
                // adjust font in a way that Cap's height matches font size,
                // (theoretically could be done via 'scale' property of FontItem,
                // but that would require to make TextInput class even more complicated
                // and could produce issues related to Quill)
                let adjustFontBinary: boolean = true; // TODO: may be not needed for some fonts (e.g. if fontScale: 1 transmitted from the API)

                if (adjustFontBinary) {
                    try {
                        if (error) {
                            console.warn('Font could not be loaded: ', error);
                            this.onLoadFontItemError(f);
                            resolve();
                            return;
                        } else {
                            // modify font

                            let newURL: string;

                            let loadNewFont: Function = () => {
                                OpenType.load(newURL, (error: any, loadedNewFont: OpenType.Font) => {
                                    if (error) {
                                        console.warn('Modified font could not be loaded: ', error);
                                        this.onLoadFontItemError(f);
                                    } else {
                                        font = loadedNewFont;
                                        f.url = newURL;
                                        f.blob = true;
                                        this.initFontItem(f, font, true);
                                    }
                                    resolve();
                                });
                            };

                            let font: OpenType.Font = loadedFont;
                            let origName: string = font.names.fontFamily.en;

                            // modify glyphs
                            // we could instead just set font.unitsPerEm = font.tables.os2.sCapHeight,
                            // but arbitary values for unitsPerEm don't work in IOS (only 1000, 1024, 1600, 2048 etc. are fine),
                            // also if unitsPerEm has been changed greatly - text may be jumping during lineHeight change (tiny bug)
                            let len: number = font.glyphs.length;
                            let sc: number = font.unitsPerEm / font.tables.os2.sCapHeight;
                            if (f.scale > 0) {
                                // sCapHeight maybe undefined or be incorrect (e.g. -1), so skip improper values
                                if (isNaN(sc) || sc < 0.1 || sc > 10) {
                                    sc = f.scale; // overwrite scale
                                    if (sc === 1) {
                                        // seems like scale wasn't set yet and no sCapHeight
                                        console.warn(
                                            `'${origName}' font may require scale adjustment (cause tables.os2.sCapHeight not found)`
                                        );
                                    }
                                } else {
                                    sc *= f.scale; // correct scale
                                }
                            }
                            let scaleProp: Function = (c: OpenType.PathCommand | OpenType.Glyph, p: string, scale: number) => {
                                if (c.hasOwnProperty(p)) {
                                    c[p] = Math.round(c[p] * scale * 100) / 100;
                                }
                            };

                            let lowerCaseGlyphLib: OpenType.Glyph[] = [];
                            let upperCaseGlyphLib: OpenType.Glyph[] = [];
                            let pathLib: OpenType.Path[] = [];
                            for (let i = 0; i < len; i++) {
                                let glyph: OpenType.Glyph = font.glyphs.get(i);
                                let char: string = String.fromCharCode(glyph.unicode);

                                if (f.useCaps && char !== char.toUpperCase()) {
                                    lowerCaseGlyphLib[glyph.unicode] = glyph;
                                } else {
                                    // scale glyph
                                    let path: OpenType.Path = typeof glyph.path === 'function' ? glyph.path() : glyph.path;

                                    if (f.sandedCenter && f.hidden) {
                                        let contours: OpenType.PathCommand[][] = this.splitCommands(path.commands);
                                        let rings: number[][][] = this.contoursToRings(contours);
                                        let nestingLevels: number[] = rings.map(
                                            (elem) => GeomUtils.getParentEnclosingRings(elem, rings).length
                                        );
                                        // leave only rings with nesting level in 1-2 range
                                        let targetIndices: number[] = nestingLevels
                                            .map((elem, index) => (elem === 1 || elem === 2 ? index : NaN))
                                            .filter((elem) => !isNaN(elem));
                                        let targetContours: OpenType.PathCommand[][] = targetIndices.map((elem) => contours[elem]);
                                        path.commands = _.flatten(targetContours);
                                    }

                                    path.commands.forEach((c) => {
                                        scaleProp(c, 'x', sc);
                                        scaleProp(c, 'y', sc);
                                        scaleProp(c, 'x1', sc);
                                        scaleProp(c, 'y1', sc);
                                        scaleProp(c, 'x2', sc);
                                        scaleProp(c, 'y2', sc);
                                    });
                                    scaleProp(glyph, 'advanceWidth', sc);
                                    glyph.path = path;

                                    if (f.useCaps && char !== char.toLowerCase()) {
                                        upperCaseGlyphLib[glyph.unicode] = glyph;
                                        pathLib[glyph.unicode] = path;
                                    }
                                }
                            }

                            if (f.useCaps) {
                                // make lower case glyphs look like upper case glyphs
                                // Important. Some characters may have same unicode, e.g. small 'i' produced by 'I'.toLowerCase()
                                // may be not equal to 'i' defined in the font, though they both have the same unicode (105)
                                let usedUnicodes: number[] = [];
                                // first pass
                                lowerCaseGlyphLib.forEach((lg, lowCharCode) => {
                                    if (lg) {
                                        let lowChar: string = String.fromCharCode(lg.unicode);
                                        let upCharCode: number = lowChar.toUpperCase().charCodeAt(0);
                                        let ug: OpenType.Glyph = upperCaseGlyphLib[upCharCode];
                                        if (ug) {
                                            let path: OpenType.Path = pathLib[upCharCode];

                                            this.setGlyphPath(font, lg, lowChar, lowCharCode, ug.advanceWidth, path);
                                            usedUnicodes.push(lowCharCode);
                                        }
                                    }
                                });
                                // second pass (needed for missing low characters)
                                upperCaseGlyphLib.forEach((ug, upCharCode) => {
                                    if (ug) {
                                        let path: OpenType.Path = pathLib[upCharCode];
                                        let upChar: string = String.fromCharCode(upCharCode);
                                        let lowCharCode: number = upChar.toLowerCase().charCodeAt(0);

                                        if (usedUnicodes.indexOf(lowCharCode) === -1) {
                                            let lg: OpenType.Glyph = lowerCaseGlyphLib[lowCharCode];
                                            let lowChar: string = upChar.toLowerCase();

                                            this.setGlyphPath(font, lg, lowChar, lowCharCode, ug.advanceWidth, path);
                                            usedUnicodes.push(lowCharCode);
                                        }
                                    }
                                });
                            }

                            // make font family unique (cause the original font family may be used somewhere else)
                            font.names.fontFamily.en += '-CNVS' + String(f.id);
                            if (f.sandedCenter && f.hidden) {
                                font.names.fontFamily.en += '-SND';
                            }
                            // create a binary copy
                            let arrayBuffer: ArrayBuffer;
                            try {
                                arrayBuffer = font.toArrayBuffer();
                            } catch (err) {
                                // reset changes
                                font.names.fontFamily.en = origName;
                                throw err;
                            }

                            window.URL = window.URL || (window as any).webkitURL;
                            const dataView = new DataView(arrayBuffer);
                            const blob = new Blob([dataView], { type: 'font/opentype' });

                            let blobUrlSupported: boolean = true; // TODO: may be not supported by older browsers
                            if (blobUrlSupported) {
                                newURL = window.URL.createObjectURL(blob);
                                loadNewFont();
                            } else {
                                let fr = new FileReader();
                                fr.onload = (e) => {
                                    newURL = fr.result as string;
                                    loadNewFont();
                                };
                                fr.readAsDataURL(blob);
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to adjust font:', f.url, err);
                        if (!(loadedFont.tables.os2 && loadedFont.tables.os2.sCapHeight)) {
                            console.warn('Missing loadedFont.tables.os2.sCapHeight');
                        }

                        this.onLoadFontItemError(f);
                        resolve();
                    }
                } else {
                    this.initFontItem(f, loadedFont, false);
                    resolve();
                }
            });
        });
    }

    protected setGlyphPath(
        font: OpenType.Font,
        g: OpenType.Glyph,
        name: string,
        charCode: number,
        advanceWidth: number,
        path: OpenType.Path
    ) {
        if (g) {
            // modify existing glyph
            g.advanceWidth = advanceWidth;
            g.path = path;
        } else {
            // create a new glyph (cause it's missing)
            let index: number = font.glyphs.length;
            let func: () => OpenType.Glyph = () => {
                g = new OpenType.Glyph({
                    name: name,
                    unicode: charCode,
                    index
                });
                g.advanceWidth = advanceWidth;
                g.path = path;
                return g;
            };
            font.glyphs.push(index, func);
        }
    }

    protected splitCommands(commands: OpenType.PathCommand[]) {
        let contours: OpenType.PathCommand[][] = [];
        let contour: OpenType.PathCommand[];

        commands.forEach((c, index) => {
            if (c.type === 'M' || index === 0) {
                contour = [];
                contours.push(contour);
            }
            contour.push(c);
        });

        return contours;
    }

    protected contoursToRings(contours: OpenType.PathCommand[][]) {
        let rings: number[][][] = [];
        let ring: number[][];
        let neighborC: OpenType.PathCommand;

        contours.forEach((contour) => {
            ring = [];
            rings.push(ring);
            contour.forEach((c, index) => {
                neighborC = contour[index === 0 ? contour.length - 1 : index - 1];
                if ((!neighborC || neighborC.x !== c.x || neighborC.y !== c.y) && !isNaN(c.x) && !isNaN(c.y)) {
                    ring.push([c.x, c.y]);
                }
            });
        });

        return rings;
    }

    protected onLoadFontItemError(f: FontItem) {
        let i: number = this.fonts.indexOf(f);
        if (i >= 0) {
            this.fonts.splice(i, 1);
        }
    }

    protected initFontItem(item: FontItem, font: OpenType.Font, sizeAdjusted: boolean = true) {
        item.fontFamily = font.names.fontFamily.en;
        if (!item.fontFamilyAlias) {
            item.fontFamilyAlias = item.fontFamily.replace('-CNVS' + String(item.id), '');
        }
        // basic font metrics
        item.ascent = font.ascender / font.unitsPerEm;
        item.descent = Math.abs(font.descender) / font.unitsPerEm;

        if (sizeAdjusted) {
            item.capHeight = 1;
        } else {
            if (font.tables.os2 && font.tables.os2.sCapHeight) {
                item.capHeight = font.tables.os2.sCapHeight / font.unitsPerEm;
            } else {
                item.capHeight = item.scale > 0 ? item.scale : item.ascent * 0.725;
            }
        }
    }

    protected isBlobFontItem(f: FontItem) {
        return f.blob || f.url.indexOf('blob:') >= 0;
    }

    protected appendFontFaces() {
        let newStyle: HTMLStyleElement = document.createElement('style');
        this.fonts.forEach((f) => {
            if (!f.format && this.isBlobFontItem(f)) {
                console.warn('for blob fonts format must be explicitly defined, font:', f.fontFamily, f.url);
            }
            newStyle.appendChild(
                document.createTextNode(
                    '@font-face {font-family: ' +
                        f.fontFamily +
                        ";src: url('" +
                        f.url +
                        "') format('" +
                        (f.format ? f.format : StrUtils.getExtension(f.url)) +
                        "');}"
                )
            );
        });

        document.head.appendChild(newStyle);
    }

    protected appendFontDummyDivs() {
        this.fonts.forEach((f) => {
            let div: HTMLDivElement = document.createElement('div');
            div.innerText = 'Hi';
            div.style.userSelect = 'none';
            div.style.pointerEvents = 'none';
            div.style.position = 'absolute';
            div.style.left = '0';
            div.style.top = '0';
            if (this.config.testMode.indexOf('font') === -1) {
                div.style.visibility = 'hidden';
            }
            div.style.fontFamily = f.fontFamily;
            document.body.appendChild(div);
        });
    }

    createText(m?: TextModel) {
        if (!m) {
            m = TextService.createTextModel();
        }

        // e.g. 0,1000|3,2000|9,1000
        let fontFormats: number[][] = m.font.split('|').map((element: string) => element.split(',').map((element) => parseInt(element)));

        // e.g. 0,1.25|3,2.25|9,1.25
        let sizeFormats: number[][] = m.size.split('|').map((element: string) => element.split(',').map((element) => parseFloat(element)));

        // e.g. 0,0,1.5,0
        let lineSpacings: number[] = m.lineSpacing.split(',').map((element) => MeasurementService.unitToPx(element));

        let t: TextInput = new TextInput({
            domBox: {
                backgroundColor: 'rgba(42, 36, 36, 0.5)'
            },
            domEditor: {
                letterSpacing: MeasurementService.unitToPx(m.spacing) + 'px',
                textAlign: this.justifyToAlign(m.justify)
            },
            shape: {
                enabled: m.shapeEnabled,
                adjust: m.shapeAdjust
            }
        });

        t.setFonts(this.fonts);
        t.lineSpacings = lineSpacings;
        t.text = m.string;

        let editor: Quill = t.editor as Quill;
        let textLen: number = t.text.length;
        for (let i: number = 0; i < fontFormats.length; i++) {
            let f: number[] = fontFormats[i];
            let fNext: number[] = fontFormats[i + 1];
            let len: number = (fNext ? fNext[0] : textLen) - f[0];
            let value: string = this.fontIDToFamily(f[1]);

            if (!value) {
                console.warn('Undefined font', f[1]);
            }

            editor.formatText(f[0], len, 'font', value);
        }

        for (let i: number = 0; i < sizeFormats.length; i++) {
            let f: number[] = sizeFormats[i];
            let fNext: number[] = sizeFormats[i + 1];
            let len: number = (fNext ? fNext[0] : textLen) - f[0];
            let value: string = MeasurementService.unitToPx(f[1]).toString();
            value = value ? value + 'px' : null;

            if (!value) {
                console.warn('Undefined size', f[1]);
            }

            editor.formatText(f[0], len, 'size', value);
        }

        t.on('text-change', this.onTextInputInput);

        const localBounds = t.getLocalBounds();
        t.pivot.x = localBounds.width / 2 + localBounds.x;
        t.pivot.y = localBounds.height / 2 + localBounds.y;
        t.x = MeasurementService.unitToPx(m.x);
        t.y = MeasurementService.unitToPx(m.y);
        t.rotation = m.rotation;
        let dt: DesignText = t as DesignText;
        dt.model = m;
        dt.updateModel = (flag: string = 'default') => {
            this.updateTextModel(dt, dt.model, flag);
        };
        dt.interactive = true;

        // effects

        if (!m.vCut && !m.frost && !m.polish) {
            m.vCut = true;
        }
        if (m.vCut) {
            this.setTextEffect(dt, 'vCut', true);
        }
        if (m.frost) {
            this.setTextEffect(dt, 'frost', true);
        }
        if (m.polish) {
            this.setTextEffect(dt, 'polish', true);
        }
        if (m.outline) {
            this.setTextEffect(dt, 'outline', true);
        }

        return dt;
    }

    setTextEffect(dt: DesignText, effect: string, value: boolean) {
        if (!dt.model.hasOwnProperty(effect)) {
            return;
        }
        dt.model[effect] = value;

        if (!dt.model.vCut && !dt.model.frost && !dt.model.polish) {
            // no effects at all, so apply some effect
            switch (effect) {
                case 'vCut':
                    effect = 'frost';
                    break;
                case 'frost':
                    if (dt.model.outline) {
                        effect = 'polish';
                    } else {
                        effect = 'vCut';
                    }
                    break;
                case 'polish':
                    if (dt.model.outline) {
                        effect = 'frost';
                    } else {
                        effect = 'vCut';
                    }
                    break;
            }

            value = true;
            dt.model[effect] = value;
        }

        switch (effect) {
            // TODO: vCut was an abstract property in the legacy app, so remove/add it on send/fetch
            case 'vCut':
                if (value) {
                    dt.model.frost = false;
                    dt.model.polish = false;
                    dt.model.outline = false;
                }
                break;

            case 'frost':
                if (value) {
                    dt.model.vCut = false;
                    dt.model.polish = false;
                }
                break;

            case 'polish':
                if (value) {
                    dt.model.vCut = false;
                    dt.model.frost = false;
                }
                break;

            case 'outline':
                if (value) {
                    dt.model.vCut = false;
                    if (!dt.model.frost && !dt.model.polish) {
                        dt.model.polish = true;
                    }
                }
                break;
        }

        // apply filters
        this.updateTextFilters(dt);
    }

    updateTextFilters(dt: DesignText) {
        let lowerFillID: string = dt.model.lowerBitmapFill;
        if (!this.as.bitmapFills[lowerFillID]) {
            return;
        }
        let color: ColorItem = this.as.sinkageColors[dt.model.sinkage];
        let ccFilter: ConvexCavityFilter;
        if (dt.filters) {
            ccFilter = dt.filters.find((element) => element instanceof ConvexCavityFilter) as ConvexCavityFilter;
        }
        if (!ccFilter) {
            ccFilter = new ConvexCavityFilter();
        }
        ccFilter.textureScale = this.container.scale.x * MeasurementService.SCALE;
        ccFilter.shadowDistance = Math.round(this.container.scale.x * MeasurementService.inchToPx(this.shadowDistanceInch) * 10) / 10;
        dt.filters = [];

        if (dt.model.vCut) {
            ccFilter.blackIsCavity = false;
            ccFilter.cavityEnabled = true;
            ccFilter.cavityTexture = color.getRT();
            ccFilter.convexEnabled = true;
            ccFilter.convexTexture = PIXI.Texture.from(this.as.bitmapFills[lowerFillID + 's'].url);
            ccFilter.outerShadowsEnabled = true;
            ccFilter.shadowsEnabled = true;
            ccFilter.shadowColor = color.shadowHex;
            ccFilter.shadowAlpha = color.shadowAlpha;

            dt.filters = [ccFilter];
        }
        if (dt.model.frost) {
            ccFilter.blackIsCavity = true;
            ccFilter.cavityEnabled = false;
            ccFilter.cavityTexture = null;
            ccFilter.convexEnabled = true;
            ccFilter.convexTexture = PIXI.Texture.from(this.as.bitmapFills[lowerFillID + 's'].url);
            ccFilter.outerShadowsEnabled = false;
            ccFilter.shadowsEnabled = false;

            dt.filters = [ccFilter];
        }
        if (dt.model.polish) {
            ccFilter.blackIsCavity = true;
            ccFilter.cavityEnabled = false;
            ccFilter.cavityTexture = null;
            ccFilter.convexEnabled = true;
            ccFilter.convexTexture = PIXI.Texture.from(this.as.bitmapFills[lowerFillID].url);
            ccFilter.outerShadowsEnabled = false;
            ccFilter.shadowsEnabled = false;

            dt.filters = [ccFilter];
        }
        if (dt.model.outline) {
            ccFilter.cavityEnabled = true;
            ccFilter.cavityTexture = color.getRT();
            ccFilter.outerShadowsEnabled = true;
            ccFilter.shadowsEnabled = true;
            ccFilter.shadowColor = color.shadowHex;
            ccFilter.shadowAlpha = color.shadowAlpha;

            this.filterOutline.thickness =
                Math.round(this.container.scale.x * MeasurementService.inchToPx(this.outlineWidthInch) * 10) / 10;

            dt.filters = [this.filterOutline, ccFilter];
        }
    }

    setTextSinkageColor(dt: DesignText, sinkageColorID: string) {
        dt.model.sinkage = sinkageColorID;
        this.updateTextFilters(dt);
    }

    private updateTextModel(item: DesignText, m: TextModel, flag: string) {
        let input: TextInput = item as TextInput;
        if (flag === 'default' || flag === 'movement') {
            m.x = MeasurementService.pxToUnit(item.x);
            m.y = MeasurementService.pxToUnit(item.y);
            m.rotation = item.rotation;
        }

        if (flag === 'default' || flag === 'text') {
            // update position because it could be auto corrected after text entered
            m.x = MeasurementService.pxToUnit(item.x);
            m.y = MeasurementService.pxToUnit(item.y);

            m.spacing = MeasurementService.pxToUnit(item.domEditorDefaultStyle.letterSpacing);
            m.justify = this.alignToJustify(item.domEditorDefaultStyle.textAlign);

            // an input always has \n at the end so remove it
            m.string = input.removeAllTrailingNewLines(input.text);

            m.numLetters = this.getNumLetters(m.string);

            this.copyTextInputContentToModel(input, m);
        }
    }

    private getNumLetters(str: string) {
        return str.replace(/\s/g, 'x').replace(/\n/g, '').replace(/\r/g, '').length;
    }

    private copyTextInputContentToModel(input: TextInput, m: TextModel) {
        let editor: Quill = input.editor;
        let contents: any = editor.getContents();

        m.font = '';
        m.size = '';
        m.lineSpacing = input.lineSpacings.map((element) => MeasurementService.pxToUnit(element)).join(',');

        let lastValues: any = {
            font: null,
            size: null
        };

        if (contents && contents.ops) {
            // deltas
            let indexChar: number = 0;
            let attrKeys: string[];

            contents.ops.forEach((operation: any) => {
                let value: number;
                if (operation.attributes) {
                    let attributes = operation.attributes;
                    attrKeys = Object.keys(operation.attributes);
                    attrKeys.forEach((key) => {
                        switch (key) {
                            case 'font':
                                value = this.fontFamilyToID(attributes[key]);

                                this.attachValueToTextModel(m, key, key, value, indexChar, lastValues);
                                break;

                            case 'size':
                                value = MeasurementService.pxToUnit(attributes[key]);

                                this.attachValueToTextModel(m, key, key, value, indexChar, lastValues);
                                break;
                        }
                    });
                }

                indexChar += operation.insert.length;
            });
        }
    }

    private attachValueToTextModel(
        m: TextModel,
        mPropName: string,
        attrKey: string,
        value: number,
        indexChar: number,
        lastValues: number[]
    ): string {
        if (lastValues[attrKey] === value) {
            return;
        }

        lastValues[attrKey] = value;
        m[mPropName] += (indexChar > 0 ? '|' : '') + indexChar + ',' + value;
    }

    get isEditing() {
        return this.editableInput ? true : false;
    }

    startTextEditing = (e?: any) => {
        if (this.editableInput) {
            return;
        }

        if (this.tt.list.length === 1) {
            let item: PIXI.Container = this.tt.list[0];

            if ((item as DesignText).model.type === 'text') {
                this.selectedInput = this.editableInput = item as DesignText;

                // handle a blur event occured when you click UI
                this.editableInput.on('blur', this.stopTextEditingAndSelectInput); //.on('text-change', this.onTextInputInput);

                this.editableInput.focus();

                this.tt.removeAllTransformables();
            }
        }

        if (e) {
            e.stopPropagation();
        }

        this.emitDataEvent(TextServiceEventType.EVENT_TEXT_EDIT_START);
    };

    stopTextEditing = (e?: any, emit: boolean = true) => {
        if (!this.editableInput) {
            return;
        }

        // handle a blur event occured when you click UI
        this.editableInput.off('blur', this.stopTextEditingAndSelectInput); //.off('text-change', this.onTextInputInput);

        // blur if not blurred
        if (this.editableInput.state !== 'DEFAULT') {
            if (this.editableInput.hasBlurListener) {
                this.editableInput.blur();
            } else {
                this.editableInput.onBlurred();
                if (!this.config.isDesktop) {
                    this.editableInput.blur(); // force hiding the soft keyboard
                }
            }
        }

        this.selectedInput = this.editableInput = null;

        if (emit) {
            this.emitDataEvent(TextServiceEventType.EVENT_TEXT_EDIT_STOP);
        }
    };

    stopTextEditingAndSelectInput = (e?: any) => {
        let input: TextInput = this.editableInput;

        this.stopTextEditing(null, false);

        this.tt.addTransformables([input]);

        this.emitDataEvent(TextServiceEventType.EVENT_TEXT_EDIT_STOP);
    };

    onTextInputInput = (input: DesignText) => {
        input.updateModel('text');

        this.emitDataEvent(TextServiceEventType.EVENT_TEXT_INPUT);
    };

    justifyToAlign(justifyValue: number): string {
        return ['left', 'center', 'right'][justifyValue];
    }

    alignToJustify(alignValue: string): number {
        return ['left', 'center', 'right'].indexOf(alignValue);
    }

    fontFamilyToID(name: string): number {
        let font: FontItem = this.fonts.find((element) => element.fontFamily === name);

        if (!font) {
            return NaN;
        }

        return font.id;
    }

    fontIDToFamily(id: number): string {
        let font: FontItem = this.fonts.find((element) => element.id === id);

        if (!font) {
            return null;
        }

        return font.fontFamily;
    }

    private emitDataEvent = (type: string, data: any = null) => {
        let event: DataEvent = { type: type, data: data };

        this.emit(event);
    };
}
