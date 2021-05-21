import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FileSaverService } from 'ngx-filesaver';
import { MessageService } from 'primeng/api';
import * as PIXI from 'pixi.js';
import printJS from 'print-js';
import { canvasToBlob } from 'blob-util';
import MultiStyleText, { TextStyleSet } from '../../pixi/multi-style-text';
import { TransformTool } from '../../pixi/transform-tool';
import { SelectionTool } from '../../pixi/selection-tool';
import { TextureUtils } from '../../pixi/utils/texture-utils';
import { DesignItem, DesignShape, PolishItem, PriceModel, Order, SceneModel } from '../models/main';
import { AssetService } from './asset.service';
import { ConfigService } from './config.service';
import { DesignService } from './design.service';
import { TextService } from './text.service';
import { ArtService } from './art.service';
import { ShapeService } from './shape.service';
import { MeasurementService } from './measurement.service';
import { PriceService } from './price.service';
import { UIService } from './ui.service';
import { UserService } from './user.service';
import { CanvasUtils } from '../utils/canvas-utils';
import { OutlineFilter } from 'pixi-filters';

export interface ExportViewSettings {
    asBlob: boolean;
    asBase64Image: boolean;
    saveToDisk: boolean;
    preserveCanvasSize: boolean;
    imageType: string;
    onlyItemsOfType: string;
    test: boolean;
}
@Injectable({
    providedIn: 'root'
})
export class ExportService {
    ds: DesignService;

    stage: PIXI.Container;

    container: PIXI.Container;

    renderer: PIXI.Renderer;

    tt: TransformTool;

    st: SelectionTool;
    // temporary container for stage (used on exporting)
    stageContainer: PIXI.Container;
    // container for print texts etc.
    exportInfoContainer: PIXI.Container;
    // when useDefaultCanvasForExport is true - an output image is directly produced from the canvas and has the same aspect ratio (arbitary),
    // otherwise a Render Texture with fixed aspect ratio will be used to produce the output image
    useDefaultCanvasForExport: boolean = false;

    exportRenderer: PIXI.Renderer;

    exportRT: PIXI.RenderTexture;
    // ratio of common paper formats - 1.4142136, but considering automatically added margins (~10% of width, we can't change margins via js)
    // value should be bigger than 1.4826 to make an exported image fit 1 page (not 2)
    exportRatio: number = 1.5;
    // for ideal printing without margins 1754px per 297mm = 150ppi (A4 format)
    exportCW: number = 1578;

    exportCH: number = Math.floor(this.exportCW / this.exportRatio);
    // preview exported image as a canvas or as a real exported base 64 image,
    // using canvas is faster
    previewAsCanvas: boolean = true;

    previewCW: number = 600;

    previewCH: number = Math.floor(this.previewCW / this.exportRatio);
    // used for preview purposes, at the moment 100% matches exported image
    previewImage: string = AssetService.BLANK_BASE_64_IMG;

    defaultExportViewSettings: ExportViewSettings = {
        asBase64Image: true,
        asBlob: false,
        saveToDisk: false,
        preserveCanvasSize: false,
        imageType: 'jpeg',
        onlyItemsOfType: null,
        test: false
    };

    exportOrderText: PIXI.Text;

    exportOrderVaseText: PIXI.Text;

    exportSizesText: MultiStyleText;

    exportPricesText: MultiStyleText;

    exportNoteText: MultiStyleText;

    exportCopyrightText: MultiStyleText;

    exportCompanyLogo: PIXI.Sprite;

    exportMonuVisionLogo: PIXI.Sprite;

    exportBg: PIXI.Graphics;

    showExportOrder: boolean = true;

    showExportSizes: boolean = false;

    showExportPrices: boolean = false;

    showExportNote: boolean = true;

    showExportCopyright: boolean = true;

    showExportCompanyLogo: boolean = true;

    showExportMonuVisionLogo: boolean = true;

    exportDetailScale: number = 1.5;
    // styles for PIXI.Text
    exportDetailStyles: PIXI.TextStyle[] = [];
    // styles for MultiStyleText
    exportDetailStyleSet: TextStyleSet;

    orderToStr: string = '';

    orderPOStr: string = '';

    orderMaterialStr: string = '';

    orderMessageStr: string = '';

    timeoutIds: any = {};

    upsideDown: boolean = false;

    constructor(
        private config: ConfigService,
        private http: HttpClient,
        private textService: TextService,
        private shapeService: ShapeService,
        private ps: PriceService,
        private ui: UIService,
        private us: UserService,
        private fileSaver: FileSaverService,
        private msgService: MessageService
    ) {}

    init() {
        // initialization of this renderer can be omitted, but then there is no antialias on the output image
        // TODO: deprecate exportRenderer (some unresolved bugs of shared generated textures)
        /*this.exportRenderer = new PIXI.Renderer({
            width: this.exportCW,
            height: this.exportCH,
            antialias: true,
            view: document.createElement('canvas'),
            backgroundColor: 0xffffff,
            resolution: 1
        });

        if (!this.exportRenderer) {
            let exportBRT: PIXI.BaseRenderTexture = new PIXI.BaseRenderTexture({
                width: this.exportCW,
                height: this.exportCH,
                scaleMode: PIXI.SCALE_MODES.LINEAR,
                resolution: 1
            });
            this.exportRT = new PIXI.RenderTexture(exportBRT);
        }*/

        this.stageContainer = new PIXI.Container();

        // fix Safari's upside down output image bug https://bugs.webkit.org/show_bug.cgi?id=156129,
        let browserName: string = this.config.userAgent.browser.name.toLowerCase();
        let osName: string = this.config.userAgent.os.name.toLowerCase();
        let isSafari: boolean = browserName.indexOf('safari') >= 0;
        let isIOS: boolean = osName === 'ios' || osName === 'ipados';
        if (isSafari || isIOS) {
            // generate a test output image and check if it is really upside down
            this.upsideDown = false;
            this.exportView({ imageType: 'jpeg', test: true }).then((result) => {
                let image = new Image();
                image.onload = () => {
                    let canvas: HTMLCanvasElement = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;

                    let context: CanvasRenderingContext2D = canvas.getContext('2d');
                    context.drawImage(image, 0, 0);

                    // one-dimensional array of RGBA values
                    let imageData: ImageData = context.getImageData(0, 0, canvas.width, canvas.height);

                    let x: number = Math.floor(this.exportCW * 0.5);
                    let y: number = Math.floor(this.exportCH * 0.25);
                    let index: number = (y * imageData.width + x) * 4;
                    let red: number = imageData.data[index];
                    let green: number = imageData.data[index + 1];
                    let blue: number = imageData.data[index + 2];

                    this.upsideDown = red > 250 && green > 250 && blue < 5;

                    console.log('Expected rgb(0, 0, 255), got rgb(', red, green, blue, '). Thus upsideDown:', this.upsideDown);
                };
                image.src = result;
            });
        }
    }

    // TODO: move all export-related features to the export service
    exportView(settings: Partial<ExportViewSettings> = null) {
        let { asBlob, asBase64Image, saveToDisk, preserveCanvasSize, imageType, onlyItemsOfType, test }: ExportViewSettings = {
            ...this.defaultExportViewSettings,
            ...settings
        };

        let renderer: PIXI.Renderer = preserveCanvasSize || !this.exportRenderer ? this.renderer : this.exportRenderer;

        return this.ds.whenSceneIsReady().then((result) => {
            return new Promise<any>((resolve, reject) => {
                if (!preserveCanvasSize) {
                    this.renderer.resize(this.exportCW, this.exportCH);
                }

                this.textService.stopTextEditing();
                // if there are some transformables it can affect blending, so remove them
                this.tt.removeAllTransformables();
                // fix a bug with lost masks on printing preview
                this.ds.updateAnchorsAndMasks();

                // timeout needed to get updated anchors in updateBlendingContext()
                setTimeout(() => {
                    this.ds.updateBlendingContext();

                    if (onlyItemsOfType) {
                        for (let item of this.container.children) {
                            if (!item.hasOwnProperty('model') || (item as DesignItem).model.type !== onlyItemsOfType) {
                                item.visible = false;
                            }
                        }
                    } else {
                        this.tt.visible = false;
                        this.st.visible = false;
                    }

                    let canvas: HTMLCanvasElement;

                    if (test) {
                        // Ukrainian flag (yellow wheat and blue sky)
                        let flag: PIXI.Graphics = new PIXI.Graphics();
                        flag.beginFill(0xffff00).drawRect(0, 0, this.exportCW, this.exportCH);
                        flag.beginFill(0x0000ff)
                            .drawRect(0, 0, this.exportCW, 0.5 * this.exportCH)
                            .endFill();
                        this.stageContainer.addChild(flag);
                    } else {
                        this.stageContainer.addChild(this.stage);
                    }

                    if (imageType !== 'png') {
                        // add a white bg, otherwise a black background may appear in some cases (Firefox + non default canvas, older Safari)
                        let bg: PIXI.Graphics = new PIXI.Graphics();
                        bg.beginFill(0xffffff).drawRect(0, 0, this.stageContainer.width, this.stageContainer.height).endFill();
                        this.stageContainer.addChildAt(bg, 0);
                    }
                    if (this.useDefaultCanvasForExport || this.exportRenderer) {
                        // warning: may produce mirrored image in Safari (undetectable by the test)
                        renderer.render(this.stageContainer);
                        canvas = renderer.view;
                    } else {
                        // warning: no antialiasing there (not achievable at the moment (PIXI 5.3.x))
                        renderer.render(this.stageContainer, this.exportRT);
                        canvas = renderer.extract.canvas(this.exportRT);
                    }
                    while (this.stageContainer.children.length > 0) {
                        this.stageContainer.removeChildAt(0);
                    }

                    if (this.upsideDown) {
                        // Fix Safari's bug - the canvas is mirrored vertically, so we create a copy of it (without any transformation,
                        // because the bug affects the copy too).
                        // Do not try to fix this bug via transformation of the stage container,
                        // because of some filters (e.g. Drop Shadow Filter))),
                        canvas = CanvasUtils.getTransformedCanvas(canvas);
                    }

                    const bringBackHidden: Function = () => {
                        // bring back all hidden objects
                        if (onlyItemsOfType) {
                            for (let item of this.container.children) {
                                item.visible = true;
                            }
                        } else {
                            this.tt.visible = true;
                            this.st.visible = true;
                        }
                    };

                    const onComplete: Function = () => {
                        bringBackHidden();
                        if (!preserveCanvasSize) {
                            this.renderer.resize(this.ds.cW, this.ds.cH);
                        }
                    };

                    if (saveToDisk || asBlob) {
                        canvasToBlob(canvas, 'image/' + imageType)
                            .then((blob) => {
                                if (saveToDisk) {
                                    this.fileSaver.save(blob, (onlyItemsOfType ? onlyItemsOfType : 'design') + '.' + imageType);
                                }
                                resolve(blob);
                                onComplete();
                            })
                            .catch((err) => {
                                // error
                                console.warn('blob error', err);
                                reject(err);
                                onComplete();
                            });
                    } else {
                        if (asBase64Image) {
                            resolve(canvas.toDataURL('image/' + imageType));
                        } else {
                            resolve(canvas);
                        }
                        onComplete();
                    }
                });
            });
        });
    }

    printImage(src?: string) {
        if (!src) {
            this.exportView().then((result) => {
                if (result) {
                    this.printImage(result);
                }
            });

            return;
        }

        printJS({ printable: src, type: 'image' });
    }

    initExportInfo() {
        this.exportInfoContainer = new PIXI.Container();

        let cw: number = this.exportCW;
        let ch: number = this.exportCH;
        let margin1: number = 15;

        // styles for usual PIXI.Text
        let st0: PIXI.TextStyle = (this.exportDetailStyles[0] = new PIXI.TextStyle());
        st0.fontFamily = 'Arial, Helvetica, sans-serif';
        st0.fontSize = 12 * this.exportDetailScale;
        st0.fill = '#000000';
        st0.padding = 5;
        st0.wordWrap = true;
        st0.wordWrapWidth = cw - margin1 * 2;

        let st1: PIXI.TextStyle = (this.exportDetailStyles[1] = st0.clone());
        st1.align = 'right';

        // style sets for MultiStyleText
        let stSet0: TextStyleSet = (this.exportDetailStyleSet = {
            default: {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: 12 * this.exportDetailScale,
                fill: '#000000',
                padding: 0,
                wordWrap: true,
                wordWrapWidth: cw - margin1 * 2
            },
            b: {
                fontWeight: 'bold'
            },
            title: {
                fontSize: 14 * this.exportDetailScale,
                fontWeight: 'bold'
            },
            small: {
                fontSize: 10 * this.exportDetailScale
            }
        });

        this.exportOrderText = new PIXI.Text('', st0);
        this.exportOrderVaseText = new PIXI.Text('', st1);
        let outlineFilter: OutlineFilter = new OutlineFilter(3, 0xffffff, 1.0);
        this.exportOrderText.filters = [outlineFilter];
        this.exportOrderVaseText.filters = [outlineFilter];

        this.exportSizesText = new MultiStyleText('', stSet0);
        this.exportPricesText = new MultiStyleText('', stSet0);
        this.exportCopyrightText = new MultiStyleText('', stSet0);
        this.exportNoteText = new MultiStyleText('', stSet0);

        this.exportCompanyLogo = new PIXI.Sprite();
        this.exportMonuVisionLogo = new PIXI.Sprite();

        this.exportBg = new PIXI.Graphics();
    }

    set showExportInfo(value: boolean) {
        if (!this.exportInfoContainer) {
            this.initExportInfo();
        }

        if (value) {
            if (this.exportInfoContainer.parent) {
                return;
            }

            // hide a possible 2nd scrollbar
            document.body.style.overflow = 'hidden';

            this.ds.whenSceneIsReady().then((result) => {
                this.stage.addChildAt(this.exportInfoContainer, this.stage.children.length);

                this.updateExportInfo();
            });
        } else {
            if (!this.exportInfoContainer.parent) {
                return;
            }

            // allow a possible 2nd scrollbar
            document.body.style.overflow = null;

            this.stage.removeChild(this.exportInfoContainer);

            this.stage.scale.set(1);
            this.stage.position.set(0, 0);
            this.exportInfoContainer.scale.set(1);
            this.exportInfoContainer.position.set(0, 0);

            // fix wrong position of the grass and the monument etc. after exporting (occurs when browser window was resized during the export process)
            this.ds.doResize();

            // fix an issue with iframe in the dom https://github.com/crabbly/Print.js/issues/387
            let iframePrint: HTMLElement = document.getElementById('printJS');
            if (iframePrint) {
                iframePrint.remove();
            }
        }
    }

    get showExportInfo() {
        return this.exportInfoContainer && this.exportInfoContainer.parent ? true : false;
    }

    updateExportInfoDelayed(loadMissingData: boolean = true) {
        clearTimeout(this.timeoutIds['expInfo']);
        this.timeoutIds['expInfo'] = setTimeout(() => {
            this.updateExportInfo(loadMissingData);
        }, 180);
    }

    async updateExportInfo(loadMissingData: boolean = true) {
        let box: PIXI.Container = this.exportInfoContainer;
        if (box && box.parent) {
            // reset transform
            this.stage.scale.set(1);
            this.stage.position.set(0, 0);
            this.exportInfoContainer.scale.set(1);
            this.exportInfoContainer.position.set(0, 0);

            let cw: number = this.useDefaultCanvasForExport ? this.ds.cW : this.exportCW;
            let ch: number = this.useDefaultCanvasForExport ? this.ds.cH : this.exportCH;
            let scd: number = this.exportDetailScale;
            let margin0: number = 10;
            let margin1: number = 15;
            let bgBounds: PIXI.Rectangle = this.ds.background ? this.ds.background.getBounds() : null;
            let bounds: PIXI.Rectangle = this.ds.getContainerBoundsWithoutGrid();
            let maxLogoWidth: number = 240 * scd;
            let maxLogoHeight: number = 80 * scd;
            let bottomY: number = ch;
            let possibleBottomY: number[] = [];
            let str: string;

            // update text styles
            if (parseFloat(String(this.exportDetailStyleSet.default.fontSize)) !== 12 * scd) {
                for (let st of this.exportDetailStyles) {
                    st.fontSize = 12 * scd;
                }

                this.exportDetailStyleSet.default.fontSize = 12 * scd;
                this.exportDetailStyleSet.title.fontSize = 14 * scd;
                this.exportDetailStyleSet.small.fontSize = 10 * scd;

                // force update MultiStyleText instances
                this.exportSizesText.styles = this.exportDetailStyleSet;
                this.exportPricesText.styles = this.exportDetailStyleSet;
                this.exportCopyrightText.styles = this.exportDetailStyleSet;
                this.exportNoteText.styles = this.exportDetailStyleSet;
            }
            for (let st of this.exportDetailStyles) {
                st.wordWrapWidth = cw - margin1 * 2;
            }
            this.exportDetailStyleSet.default.wordWrapWidth = cw - margin1 * 2;

            // order

            if (this.showExportOrder) {
                str = 'To: ' + this.orderToStr;
                str += '\nPO#: ' + this.orderPOStr;
                str += '\nMaterial: ' + this.orderMaterialStr;
                str += '\nMessage: ' + this.orderMessageStr;
                str +=
                    '\n\n' +
                    this.ds
                        .getArts([ArtService.ART_TYPE_COMPONENT, ArtService.ART_TYPE_PANEL])
                        .map((elem) => elem.model.name)
                        .filter((elem, index, array) => array.indexOf(elem) === index) // get unique names only
                        .join('\n');

                this.exportOrderText.text = str;
                this.exportOrderText.x = margin1 + (bgBounds ? margin0 : 0);
                this.exportOrderText.y = margin0;

                box.addChild(this.exportOrderText);
            } else {
                if (this.exportOrderText.parent) {
                    this.exportOrderText.parent.removeChild(this.exportOrderText);
                }
            }

            // order vases

            if (this.showExportOrder) {
                str = this.ds
                    .getArts([ArtService.ART_TYPE_VASE])
                    .map((elem) => elem.model.name)
                    .join('\n');
                if (str) {
                    str = 'Vases:\n' + str;
                }
                this.exportOrderVaseText.text = str;
                this.exportOrderVaseText.pivot.x = this.exportOrderVaseText.width;
                this.exportOrderVaseText.x = cw - margin1 - (bgBounds ? margin0 : 0);
                this.exportOrderVaseText.y = margin0;

                box.addChild(this.exportOrderVaseText);
            } else {
                if (this.exportOrderVaseText.parent) {
                    this.exportOrderVaseText.parent.removeChild(this.exportOrderVaseText);
                }
            }

            // copyright

            if (this.showExportCopyright) {
                str = this.us.copyrightNotice;
                this.exportCopyrightText.text = str;
                this.exportCopyrightText.x = margin1;
                bottomY = this.exportCopyrightText.y = bottomY - margin1 - this.exportCopyrightText.height;

                box.addChild(this.exportCopyrightText);
            } else {
                if (this.exportCopyrightText.parent) {
                    this.exportCopyrightText.parent.removeChild(this.exportCopyrightText);
                }
            }

            // manufacturer note

            if (this.showExportNote) {
                str = this.us.manufacturersNote;
                this.exportNoteText.text = str;
                this.exportNoteText.x = margin1;
                bottomY = this.exportNoteText.y = bottomY - margin1 - this.exportNoteText.height;

                box.addChild(this.exportNoteText);
            } else {
                if (this.exportNoteText.parent) {
                    this.exportNoteText.parent.removeChild(this.exportNoteText);
                }
            }

            // sizes

            possibleBottomY.push(bottomY);
            if (this.showExportSizes) {
                let shapes: DesignShape[] = this.ds.getShapes();
                // make tablets go first
                shapes = shapes.reverse();
                // limited height to show sizes, so show only limited amount of them
                //let maxRows:number = 4
                //shapes.splice(maxRows)
                str = '';
                shapes.forEach((shape) => {
                    if (str) {
                        str += '\n';
                    }
                    str += '<title>' + (ShapeService.isBaseShape(shape) ? 'Base' : 'Tablet') + ': </title><b>';

                    str += Math.round(shape.model.width) + '" x ';
                    if (this.shapeService.viewedFromTop(shape.model)) {
                        str += Math.round(shape.model.height) + '" x ';
                        str += Math.round(shape.model.depth) + '"';
                    } else {
                        str += Math.round(shape.model.depth) + '" x ';
                        str += Math.round(shape.model.height) + '"';
                    }
                    let polish: PolishItem = this.shapeService.getAvailablePolishes(shape).find((elem) => elem.id === shape.model.polish);
                    str += '   ' + polish.name + '</b>';
                });

                this.exportSizesText.text = str;
                this.exportSizesText.x = maxLogoWidth + margin1 * 2;
                this.exportSizesText.y = bottomY - margin1 - this.exportSizesText.height;

                possibleBottomY.push(this.exportSizesText.y);

                box.addChild(this.exportSizesText);
            } else {
                if (this.exportSizesText.parent) {
                    this.exportSizesText.parent.removeChild(this.exportSizesText);
                }
            }

            // prices

            if (this.showExportPrices) {
                let prices: PriceModel[];
                if ((loadMissingData && (!this.ui.displayPricing || this.ps.prices.length === 0)) || !this.exportPricesText.parent) {
                    await this.ds.getPrices(true);
                }
                prices = this.ps.prices;

                str = '';
                prices.forEach((price) => {
                    if (str) {
                        str += '\n';
                    }
                    str += '<title>' + price.label + ' </title>(';

                    price.materialNames.forEach((mn, index) => {
                        if (index > 0) {
                            str += ', ';
                        }
                        str += mn;
                    });

                    str += ')';
                });

                this.exportPricesText.text = str;
                this.exportPricesText.x = cw - maxLogoWidth - margin1 * 2 - this.exportPricesText.width;
                this.exportPricesText.y = bottomY - margin1 - this.exportPricesText.height;

                possibleBottomY.push(this.exportPricesText.y);

                box.addChild(this.exportPricesText);
            } else {
                if (this.exportPricesText.parent) {
                    this.exportPricesText.parent.removeChild(this.exportPricesText);
                }
            }

            // company logo

            if (this.showExportCompanyLogo) {
                let src: string = this.config.getAssetFullURL(this.us.companyLogo);
                if (src) {
                    // logo should be power-of-two for a nice resizing
                    let texture: PIXI.Texture = await TextureUtils.getTexture(src);

                    if (texture) {
                        if (this.showExportCompanyLogo) {
                            let sc: number = Math.min(maxLogoWidth / texture.width, maxLogoHeight / texture.height);

                            this.exportCompanyLogo.texture = texture;
                            this.exportCompanyLogo.anchor.set(0, 1);
                            this.exportCompanyLogo.x = margin1;
                            this.exportCompanyLogo.y = bottomY - margin1;
                            this.exportCompanyLogo.scale.set(sc);

                            possibleBottomY.push(bottomY - margin1 - this.exportCompanyLogo.height + margin0);

                            box.addChild(this.exportCompanyLogo);
                        }
                    }
                }
            } else {
                if (this.exportCompanyLogo.parent) {
                    this.exportCompanyLogo.parent.removeChild(this.exportCompanyLogo);
                }
            }

            // monuvision logo (user logo)

            if (this.showExportMonuVisionLogo) {
                let src: string = this.config.getAssetFullURL(this.us.userLogo || this.ui.logo);
                if (src) {
                    // logo should be power-of-two for a nice resizing
                    let texture: PIXI.Texture = await TextureUtils.getTexture(src);

                    if (texture) {
                        let sc: number = Math.min(maxLogoWidth / texture.width, maxLogoHeight / texture.height);

                        this.exportMonuVisionLogo.texture = texture;
                        this.exportMonuVisionLogo.anchor.set(1, 1);
                        this.exportMonuVisionLogo.x = cw - margin1;
                        this.exportMonuVisionLogo.y = bottomY - margin1;
                        this.exportMonuVisionLogo.scale.set(sc);

                        possibleBottomY.push(bottomY - margin1 - this.exportMonuVisionLogo.height + margin0);

                        box.addChild(this.exportMonuVisionLogo);
                    }
                }
            } else {
                if (this.exportMonuVisionLogo.parent) {
                    this.exportMonuVisionLogo.parent.removeChild(this.exportMonuVisionLogo);
                }
            }

            bottomY = Math.min(...possibleBottomY);

            // bg and stage
            this.exportBg.clear();
            if (bottomY !== ch) {
                // background may not cover logos completely, cause they have special bottomY calculation
                this.exportBg
                    .beginFill(0xffffff, 1)
                    .drawRect(0, bottomY, cw, ch - bottomY)
                    .endFill();
                box.addChildAt(this.exportBg, 0);

                // shift/scale stage temporarily
                // extra margin
                bottomY -= margin0 * 2;

                let extraHeight: number = bgBounds ? MeasurementService.inchToPx(4) : margin0;
                let sc: number = Math.max(bounds.width / (cw - 2 * margin1), (bounds.height + extraHeight) / bottomY);

                if (bgBounds) {
                    let bgSc: number = Math.min(bgBounds.width / (cw - 2 * margin1), bgBounds.height / bottomY);
                    if (bgSc > sc) {
                        sc = bgSc;
                    }
                }
                this.stage.scale.set(1 / sc);
                // align
                let xBoundsToAlign: PIXI.Rectangle;
                let yBoundsToAlign: PIXI.Rectangle;
                // x
                xBoundsToAlign = bgBounds ? bgBounds : bounds;
                let sCenterX: number = xBoundsToAlign.x + xBoundsToAlign.width / 2;
                this.stage.x = cw / 2 - sCenterX * this.stage.scale.x;
                // y (can align the bottom of the background with the bottom or the center of the conainter (monument) with the center)
                yBoundsToAlign = bgBounds ? bgBounds : bounds;
                let sBottomY: number = yBoundsToAlign.y + yBoundsToAlign.height;
                yBoundsToAlign = bounds;
                let sCenterY: number = yBoundsToAlign.y + yBoundsToAlign.height / 2;
                this.stage.y = Math.max(bottomY - sBottomY * this.stage.scale.y, bottomY / 2 - sCenterY * this.stage.scale.y);

                this.exportInfoContainer.scale.set(1 / this.stage.scale.y);
                this.exportInfoContainer.x = -this.stage.x / this.stage.scale.x;
                this.exportInfoContainer.y = -this.stage.y / this.stage.scale.y;
            }

            if (this.previewAsCanvas) {
                let previewCanvas: HTMLCanvasElement = document.getElementById('preview-canvas') as HTMLCanvasElement;
                if (previewCanvas) {
                    // generate exported canvas
                    this.exportView({ asBase64Image: false }).then((result) => {
                        let context: CanvasRenderingContext2D = previewCanvas.getContext('2d');
                        try {
                            context.imageSmoothingQuality = 'high';
                        } catch (err) {
                            console.warn(err);
                        }
                        context.drawImage(
                            result as HTMLCanvasElement,
                            0,
                            0,
                            this.exportCW,
                            this.exportCH,
                            0,
                            0,
                            this.previewCW,
                            this.previewCH
                        );
                    });
                }
            } else {
                // generate exported image
                this.exportView().then((result) => {
                    this.previewImage = result;
                });
            }
        }
    }

    sendEmail(touser: string, tomail: string, fromuser: string, frommail: string, message: string, design: SceneModel) {
        let validationErrorMsgs: string[] = [];

        if (!touser.trim()) {
            validationErrorMsgs.push('Please enter the name of the recipient.');
        }

        if (!tomail.trim()) {
            validationErrorMsgs.push("Please enter the recipient's email address.");
        }

        if (!fromuser.trim()) {
            validationErrorMsgs.push('Please enter your name.');
        }

        if (!frommail.trim()) {
            validationErrorMsgs.push('Please enter your email address.');
        }

        if (validationErrorMsgs.length > 0) {
            this.msgService.add({ severity: 'error', summary: validationErrorMsgs[0], detail: '' });
            return;
        }

        this.msgService.add({ severity: 'info', summary: 'Sending Email...', detail: '' });

        let cids: string = this.getCids();
        let proofid: string = Math.floor(Math.random() * 100000000).toString();

        let body: any = {
            touser,
            tomail,
            fromuser,
            frommail,
            message,
            cids,
            proofid,
            design
        };

        const url: string = this.config.apiURL + 'email';
        return this.exportView()
            .then((result) => {
                body.image = result;
                return this.http.post(url, body, { responseType: 'text' as 'json' }).toPromise();
            })
            .then((result) => {
                this.msgService.add({ severity: 'success', summary: 'Email Sent', detail: '' });
                return result;
            })
            .catch((err) => {
                console.warn(err);
                this.msgService.add({ severity: 'error', summary: 'Mail Service is not available', detail: '' });
            });
    }

    submitOrder(order: Order) {
        let validationErrorMsgs: string[] = [];

        if (!order.name || !order.name.trim()) {
            validationErrorMsgs.push('Please enter your name.');
        }

        if (!order.family || !order.family.trim()) {
            validationErrorMsgs.push('Please enter family name.');
        }

        if (!order.email || !order.email.trim()) {
            validationErrorMsgs.push('Please enter your email address.');
        }

        if (!order.tel || !order.tel.trim()) {
            validationErrorMsgs.push('Please enter your telephone number.');
        }

        if (!order.ship || !order.ship.trim()) {
            validationErrorMsgs.push('Please specify shipping details.');
        }

        if (validationErrorMsgs.length > 0) {
            this.msgService.add({ severity: 'error', summary: validationErrorMsgs[0], detail: '' });
            return Promise.reject(validationErrorMsgs[0]);
        }

        this.msgService.add({ severity: 'info', summary: 'Submitting Order...', detail: '' });

        if (this.us.buyNowPricing) {
            // no need to call getPrices() here, cause it is always automatically called on Buy Now window
            if (this.ps.isLoading) {
                throw new Error("Can't include prices...");
            } else {
                order.priceRetail = this.ps.prices.map((elem) => elem.value + ' (' + elem.materialNames.join(',') + ')').join(' ; ');
                order.priceWholesale = this.ps.prices.map((elem) => elem.wholesaleValue).join(' ; ');
            }
        }

        let cids: string = this.getCids();
        let proofid: string = Math.floor(Math.random() * 100000000).toString();

        let body: any = {
            ...order,
            cids,
            proofid
        };

        const url: string = this.config.apiURL + 'submit';
        return this.exportView()
            .then((result) => {
                body.image = result;
                return this.http.post(url, body, { responseType: 'text' as 'json' }).toPromise();
            })
            .then((result) => {
                this.msgService.add({ severity: 'success', summary: 'Order Submitted', detail: '' });
                return result;
            })
            .catch((err) => {
                console.warn(err);
                this.msgService.add({ severity: 'error', summary: 'Customer Service is not available', detail: '' });
                throw err;
            });
    }

    exportAsVectorAndImageArchive(includeVectors: boolean = true) {
        this.msgService.add({ severity: 'info', summary: 'Downloading...', detail: '' });

        if (includeVectors) {
            const params: URLSearchParams = new URLSearchParams();

            params.set('cids', this.getCids());

            const baseUrl: string = this.config.apiURL;

            let url: string = baseUrl + 'export' + '?' + params;

            return this.exportView({ asBlob: false })
                .then((result) => {
                    const body: any = result;
                    return this.http.post(url, body, { responseType: 'blob' }).toPromise();
                })
                .then((result) => {
                    this.fileSaver.save(result, 'design.zip');
                })
                .catch((err) => {
                    console.warn(err);
                    this.msgService.add({ severity: 'error', summary: 'Error while downloading', detail: '' });
                });
        } else {
            // only the image, no need to send it to the server
            return this.exportView({ saveToDisk: true });
        }
    }

    getCids() {
        let cids: string = this.ds
            .getArts()
            .map((elem) => elem.model.compID)
            .filter((elem) => elem)
            .filter((elem, index, array) => array.indexOf(elem) === index) // get unique compIDs only
            .join(',');

        return cids;
    }
}
