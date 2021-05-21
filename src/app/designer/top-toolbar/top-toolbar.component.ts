import { Component, ElementRef, OnInit } from '@angular/core';
import * as KeyboardManager from 'keyboardjs';
import { ConfirmationService, Message, SelectItem } from 'primeng/api';
import { DesignData, DesignShape, Order, PolishItem } from '../shared/models/main';
import { DesignService } from '../shared/services/design.service';
import { BackgroundService } from '../shared/services/background.service';
import { SceneService } from '../shared/services/scene.service';
import { TextService } from '../shared/services/text.service';
import { PriceService } from '../shared/services/price.service';
import { DocumentationService, DocSection } from '../shared/services/documentation.service';
import { ConfigService } from '../shared/services/config.service';
import { ExportService } from '../shared/services/export.service';
import { UIService } from '../shared/services/ui.service';
import { UserService } from '../shared/services/user.service';
import { ShapeService } from '../shared/services/shape.service';
import { AssetService } from '../shared/services/asset.service';
@Component({
    selector: 'top-toolbar',
    templateUrl: './top-toolbar.component.html',
    styleUrls: ['./top-toolbar.component.scss']
})
export class TopToolbarComponent implements OnInit {
    libraryContainerStyle: any = {};

    libraryContentStyle: any = {};

    dialog2W: number = 552;

    dialog2H: number = 380; // content's height (without the footer and the header)

    bgContainerStyle: any = { maxWidth: this.dialog2W + 'px', minWidth: this.dialog2W + 'px' };

    bgContentStyle: any = { padding: 0, borderWidth: 1, maxHeight: this.dialog2H + 'px' };

    galleryLayout: string = 'grid'; // 'grid' or 'list'

    selectedExportDetails: string[] = [];

    sceneFileToSave: DesignData;

    helpSections: DocSection[];

    shippingTypes: SelectItem[];

    shippingInfoMsg: string;

    orderSuccessMsg: string;

    myName: string;

    familyName: string;

    myEmail: string;

    myTel: string;

    selectedShippingType: any;

    shapeInfo: string = 'Info about shapes';

    showToolBar : boolean = true;

    constructor(
        public config: ConfigService,
        public ds: DesignService,
        public as: AssetService,
        public shapeService: ShapeService,
        public bgService: BackgroundService,
        public ss: SceneService,
        public textService: TextService,
        public ps: PriceService,
        public docService: DocumentationService,
        public es: ExportService,
        public ui: UIService,
        public us: UserService,
        public confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        KeyboardManager.bind(
            'ctrl + m',
            (e) => {
                this.ui.displayWholesalePricing = !this.ui.displayWholesalePricing;
                if (
                    (!this.ui.displayPricing && this.ui.displayWholesalePricing) ||
                    (this.ui.displayPricing && !this.ui.displayWholesalePricing)
                ) {
                    // getting prices
                    (document.querySelector('#pricing-btn .ui-button-text.ui-unselectable-text') as any).click();
                }

                e.preventDefault();
            },
            (e) => {
                e.preventDefault();
            }
        );

        this.shippingTypes = [
            { label: 'Blank', value: 'Blank' },
            { label: 'Carved', value: 'Carved' }
        ];
    }

    get isHeaderCompact() {
        return (this.spot2Logo || this.spot3Logo) && window.innerWidth < 1440;
    }

    get spot2Logo() {
        if (this.isUniqueLogo(this.us.companyLogo)) {
            return this.us.companyLogo;
        }
        return null;
    }

    get spot3Logo() {
        if (this.isUniqueLogo(this.us.userLogo)) {
            return this.us.userLogo;
        }
        return null;
    }

    isUniqueLogo(logo: string) {
        if (logo && logo !== this.ui.logo) {
            return true;
        }
        return null;
    }

    onSceneAdd = (e?: any) => {
        if (!this.ui.displaySceneLibrary) {
            this.ui.closeDialogs();
        }
        this.ui.displaySceneLibrary = !this.ui.displaySceneLibrary;
    };

    onSceneDataLoadComplete = (data: DesignData) => {
        this.ds.addScene(data);
        this.ui.displaySceneLibrary = false;
    };

    onSceneDataRemoveComplete = (data: DesignData) => {
        this.ss.removeDataFromRecent(data, this.ss.recentSceneImages);
    };

    onSceneSave = (e?: any) => {
        if (!this.ui.displaySceneSaveLibrary) {
            this.ds.getSceneFileToSave().then((file) => {
                this.sceneFileToSave = file;
                this.ui.closeDialogs();
                this.ui.displaySceneSaveLibrary = true;
            });
        } else {
            this.ui.displaySceneSaveLibrary = false;
        }
    };

    onSceneDataSaveComplete = (data: DesignData) => {
        //this.ss.removeDataFromRecent(data, this.ss.recentSceneImages);
        this.ui.displaySceneSaveLibrary = false;
    };

    onSceneDataRightClick = (data: DesignData) => {
        this.ss.addDataToRecent(data, this.ss.recentSceneImages);
    };

    onSceneExportPrint = () => {
        this.ui.closeDialogs();
        this.ui.closeExportSections();
        this.ui.displaySceneExportPrint = true;
        this.es.showExportInfo = true;
    };

    onSceneExportEmailDownload = () => {
        this.ui.closeDialogs();
        this.ui.closeExportSections();
        this.ui.displaySceneExportEmailDownload = true;
        this.es.showExportInfo = true;
    };

    onSceneExportBuyNow = () => {
        this.ui.closeDialogs();
        this.ui.closeExportSections();
        this.ui.displaySceneExportBuyNow = true;

        this.updateShapeInfo();

        this.es.showExportOrder = true;
        this.es.showExportSizes = true;
        this.es.showExportPrices = true;
        this.es.showExportNote = false;
        this.es.showExportCopyright = false;
        this.es.showExportCompanyLogo = true;
        this.es.showExportMonuVisionLogo = true;

        this.es.showExportInfo = true;

        this.orderSuccessMsg = '';
    };

    onSceneExportHide = () => {
        this.es.showExportInfo = false;
    };

    onExportDetailChange() {
        this.es.updateExportInfoDelayed(false);
    }

    onShippingTypeChange() {
        let newMsg: string = '';
        if (this.selectedShippingType.toLowerCase() === 'carved') {
            newMsg =
                " If Carved, our service includes a review of your design by our experienced art staff. Please advise if you wish to leave design details to our artist's discretion, or if you have any specific instructions such as letter size, sinkage (litho) colors";
        }

        this.shippingInfoMsg = newMsg;
    }

    onDownloadImage = () => {
        this.es.exportAsVectorAndImageArchive(false);
    };

    onDownloadVectorsAndImage = () => {
        this.es.exportAsVectorAndImageArchive();
    };

    onPrint() {
        this.es.printImage();
    }

    onSendEmail(touser: string, tomail: string, fromuser: string, frommail: string, message: string) {
        this.es.sendEmail(touser, tomail, fromuser, frommail, message, this.ss.scene.model);
    }

    onSubmitOrder() {
        let order: Order = {
            name: this.myName,
            family: this.familyName,
            email: this.myEmail,
            tel: this.myTel,
            ship: this.selectedShippingType,
            message: this.es.orderMessageStr,
            design: this.ss.scene.model
        };
        this.es.submitOrder(order).then((result) => {
            this.orderSuccessMsg = "That's it! Thank you for your order. You should receive an acknowledgement in 1-2 business days.";
        });
    }

    updateShapeInfo() {
        let shapes: DesignShape[] = this.ds.getShapes();
        // make tablets go first
        shapes = shapes.reverse();

        let str: string = '';

        shapes.forEach((shape) => {
            if (str) {
                str += '\n';
            }
            str += ShapeService.isBaseShape(shape)
                ? shape.model.lowerShapesInStack > 0
                    ? 'SubBase'
                    : 'Base'
                : this.shapeService.getTabletAlias(shape.model);

            str += ':  ';

            str += Math.round(shape.model.width) + '" x ';
            if (this.shapeService.viewedFromTop(shape.model)) {
                str += Math.round(shape.model.height) + '" x ';
                str += Math.round(shape.model.depth) + '"';
            } else {
                str += Math.round(shape.model.depth) + '" x ';
                str += Math.round(shape.model.height) + '"';
            }
            let polish: PolishItem = this.shapeService.getAvailablePolishes(shape).find((elem) => elem.id === shape.model.polish);
            str += '   ' + polish.name;

            str += '   ' + this.as.bitmapFills[shape.model.color].name;
        });

        this.shapeInfo = str;
    }

    onBgAdd = (e?: any) => {
        if (!this.ui.displayBgLibrary) {
            this.ui.closeDialogs();
        }
        this.ui.displayBgLibrary = !this.ui.displayBgLibrary;
    };

    onBgDataLoadComplete = (bgData: DesignData) => {
        this.ds.addBackground(bgData);
        this.ui.displayBgLibrary = false;
    };

    onBgDataRightClick = (bgData: DesignData) => {
        this.bgService.addDataToRecent(bgData, this.bgService.recentBackgroundImages);
    };

    getDialog2X() {
        return 109 + (this.ds.cW - this.dialog2W) * 0.5;
    }

    getDialog2Y() {
        return 132;
    }

    onRefresh = (e?: any) => {
        if (!this.ui.displayRefresh) {
            return;
        }

        this.ui.closeDialogs();

        this.confirmationService.confirm({
            message: 'You are about to reload. Any unsaved work will be lost. Do you want to proceed?',
            header: 'Page Reload',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.ui.displayRefresh = false;
                window.location.reload();
            },
            reject: () => {
                this.ui.displayRefresh = false;
            }
        });
    };

    onHelp = (e?: any) => {
        if (this.ui.displayHelp) {
            this.ui.displayHelp = false;
            return;
        }

        if (this.config.testMode.indexOf('help') >= 0 && (!this.helpSections || this.helpSections.length === 0)) {
            this.docService.getHelpSections().then((result) => {
                this.helpSections = result;
                setTimeout(() => {
                    this.ui.closeDialogs();
                    this.ui.displayHelp = true;
                });
            });
        } else {
            this.ui.closeDialogs();
            this.ui.displayHelp = true;
        }
    };

    onPricingToggle = (e?: any) => {
        if (this.ui.displayPricing) {
            this.ds.getPrices();
        } else {
            this.ui.displayWholesalePricing = false;
        }
        this.ds.doAutoZoomDelayed();
    };

    /**
     * 
     * @param e
     * Created by Justin
     */
    onShowingToolBarToggle = (e?: any) => {
        // invert the toggle value
        this.showToolBar = !this.showToolBar;
    };

    goToLink(url: string) {
        window.open(url, '_blank');
    }

    replaceNumbers(str: string, byZero: boolean = true) {
        if (str) {
            if (byZero) {
                str = str.replace(/\d/g, '0');
            } else {
                str = str
                    .replace('2', 'Z')
                    .replace('3', 'E')
                    .replace('4', 'A')
                    .replace('5', 'S')
                    .replace('6', 'G')
                    .replace('7', 'V')
                    .replace('8', 'B')
                    .replace('9', 'P');
            }
        }

        return str;
    }
}
