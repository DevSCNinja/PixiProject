import { Component, Input, EventEmitter, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { TreeNode, MessageService, MenuItem, ConfirmationService } from 'primeng/api';
import { ArtService } from '../shared/services/art.service';
import { DesignData, DesignDataCategory, NodeService, NodeServicePageFilesResponse } from '../shared/models/main';
import { ConfigService } from '../shared/services/config.service';
import { StrUtils } from '../shared/utils/str-utils';
import { CanvasUtils } from '../shared/utils/canvas-utils';
import { BackgroundService } from '../shared/services/background.service';
import { DesignService } from '../shared/services/design.service';
import { DataUtils } from '../shared/utils/data-utils';

interface FilesLoadRequest {
    id?: string;
    node?: TreeNode;
    isSearch?: boolean;
    searchStr?: string;
    searchCategoryID?: string;
    page?: number;
    files?: DesignData[];
}
@Component({
    selector: 'library',
    templateUrl: './library.component.html',
    styleUrls: ['./library.component.scss']
})
export class LibraryComponent implements OnInit {
    @ViewChild('dv', { static: false }) dv: any;

    @ViewChild('saveInput', { static: false }) saveInput: any;

    @Input() nodeService: NodeService;

    @Input() defaultNodeNames: string[];

    @Input() types: string[] = []; // component, panel, vase, shape etc.

    @Input() compactLayout: boolean = false;

    @Input() fileToSave: DesignData;

    @Input() visible: boolean = false;

    @Output() visibleChange: EventEmitter<boolean> = new EventEmitter<boolean>();

    @Input() saveVisible: boolean = false;

    @Input() searchVisible: boolean = true;

    @Input() subSearchVisible: boolean = false;
    // set to false for better synchronization (e.g. you edit files or categories in real time)
    @Input() retainStateAllowed: boolean = true;

    @Input() header: string;

    @Input() minX: number = 0;

    @Input() minY: number = 0;

    @Input() positionLeft: number = NaN;

    @Input() positionTop: number = NaN;

    @Input() containerStyle: any;

    @Input() contentStyle: any;

    @Input() recentFiles: DesignData[] = [];

    @Input() recentFilesDescription: string = 'Tip: Right click on an image to manually add it to "Recent"';

    @Input() uploadVisible: boolean = true;

    @Input() apiPagination: boolean = false;

    @Output() onSelect: EventEmitter<DesignData> = new EventEmitter<DesignData>();

    @Output() onRemove: EventEmitter<DesignData> = new EventEmitter<DesignData>();

    @Output() onSave: EventEmitter<DesignData> = new EventEmitter<DesignData>();

    @Output() onRightClick: EventEmitter<DesignData> = new EventEmitter<DesignData>();

    uploadID: number;

    galleryLayout: string = 'grid'; // 'grid' or 'list'

    nodes: TreeNode[] = [];

    @Input() selectedNode: TreeNode;

    @Output() selectedNodeChange: EventEmitter<TreeNode> = new EventEmitter<TreeNode>();

    @Input() searchNode: TreeNode = { label: 'Search Result' }; // dummy

    crumbs: MenuItem[] = [];

    homeCrumb: MenuItem;

    files: DesignData[] = [];

    fileSortOrder: number = -1;

    fileSortField: string = 'title';

    isLoadingFiles: boolean = false;

    isRemovingFiles: boolean = false;

    isSavingFiles: boolean = false;

    lastRequest: FilesLoadRequest = {};

    lastSuccessfulRequest: FilesLoadRequest = {};

    isResettingPaginator: boolean = false;

    hoverImage: DesignData;

    nodeDescription: string = '...Loading';

    notFound: boolean = false;

    retainState: boolean = false;

    total: number;

    constructor(
        public config: ConfigService,
        public ds: DesignService,
        public msgService: MessageService,
        public confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.homeCrumb = { icon: 'pi pi-home', command: this.onCrumbClick };

        this.updateUploadID();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.visible && changes.visible.currentValue) {
            this.retainState = false;

            this.nodeService
                .getCategoriesTree(false, this.types)
                .then((result) => {
                    this.nodes = result;
                    if (this.compactLayout) {
                        // if no primeng's tree component used then manually add 'parent' property for each node
                        DataUtils.addParentPropToTree(this.nodes, 'children');
                    }
                    // select some node
                    if (!this.selectedNode && this.defaultNodeNames && this.defaultNodeNames.length > 0) {
                        let i: number = -1;
                        let k: number = 0;
                        while (i === -1 && k < this.defaultNodeNames.length) {
                            i = this.nodes.findIndex((elem) => elem.label === this.defaultNodeNames[k]);
                            k++;
                        }
                        if (i >= 0) {
                            this.selectNode(this.nodes[i]);
                            this.onNodeSelect();
                        }
                    }
                })
                .catch((err) => console.warn(err))
                .finally(() => {
                    this.scrollToSelectedNode();
                    if (this.saveVisible && this.fileToSave) {
                        this.saveInput.nativeElement.value = this.fileToSave.title;
                    }
                });
        }
    }

    get compactTreeVisible() {
        return this.files.length === 0 || this.isLoadingFiles ? true : false;
    }

    get itemsPerPage() {
        return this.compactLayout ? 24 : 12;
    }
    // beside ancestors includes the node to the result
    getNodeAncestors(node: TreeNode) {
        let items: MenuItem[] = [];

        if (node) {
            do {
                let n: TreeNode = node;

                items.unshift({
                    label: node.label,
                    command: (e?: Event) => {
                        this.onCrumbClick(e, n);
                    }
                });
                node = node.parent;
            } while (node);
        }

        return items;
    }

    // TODO: replace by flexbox layout if possible
    getCompactTreeMaxHeight() {
        let cMaxH: number = parseInt(this.contentStyle.maxHeight);
        const border = 1;
        let maxH: number =
            this.contentStyle && !isNaN(cMaxH)
                ? cMaxH - (this.searchVisible ? 64 : 30) - (this.crumbs.length > 0 ? 38 : 0) - (this.uploadVisible ? 0 : 15) - 2 * border
                : 200;

        return maxH;
    }

    updCrumbs(search: boolean = false) {
        if (search) {
            this.crumbs = this.getNodeAncestors(this.searchNode);
        } else {
            this.crumbs = this.getNodeAncestors(this.selectedNode);
        }
    }

    onCrumbClick = (event?: any, node?: any) => {
        if (!node || node !== this.selectedNode) {
            this.cancelLoading();
            this.files = [];
            this.notFound = false;
            this.selectNode(node);
            this.updCrumbs();
            this.scrollToSelectedNode();
        }
    };

    scrollToSelectedNode(cb?: Function) {
        if (!this.selectedNode || this.compactLayout) {
            if (typeof cb === 'function') {
                cb();
            }
            return;
        }
        setTimeout(() => {
            let elements: NodeListOf<Element> = document.querySelectorAll('span.ui-treenode-label span.ng-star-inserted');

            for (let i: number = 0; i < elements.length; i++) {
                let elem: Element = elements[i];

                if (elem.children.length === 0 && elem.textContent === this.selectedNode.label) {
                    elem.scrollIntoView(false);

                    break; // not return
                }
            }

            if (typeof cb === 'function') {
                cb();
            }
        }, 100);
    }

    onLazyLoad(event?: any) {
        if (this.apiPagination && !this.isResettingPaginator) {
            if (this.lastSuccessfulRequest.isSearch) {
                this.onSearch(
                    this.lastSuccessfulRequest.searchStr,
                    Math.floor(event.first / this.itemsPerPage) + 1,
                    this.lastSuccessfulRequest.searchCategoryID
                );
            } else {
                this.onNodeSelect(null, Math.floor(event.first / this.itemsPerPage) + 1);
            }
        }
    }

    onNodeSelect(event?: any, page: number = 1) {
        if (!this.apiPagination) {
            this.removeFilter();
        }

        let node: TreeNode = event && event.node ? event.node : this.selectedNode;
        if (!node) {
            return;
        }

        let category: DesignDataCategory = node.data as DesignDataCategory;

        let id: string = Math.floor(Math.random() * 10000000).toString();
        let newRequest = { id, node, page };

        if (this.compactLayout) {
            this.files = [];
            this.notFound = false;
            this.selectNode(node);
            this.updCrumbs();
        }

        // allow loading only for the deepest nodes, (if you want to allow for any node - maybe
        // limitation of concurrent promises will be needed in getImageList())
        if (!node.children) {
            this.selectNode(node);
            this.isLoadingFiles = true;
            this.updCrumbs();

            this.lastRequest = newRequest;

            let params: any[] = [this.selectedNode, true, [category.type]];
            if (this.apiPagination) {
                params.push(page, this.itemsPerPage);
            }

            this.nodeService.getFiles
                .apply(this.nodeService, params)
                .then((result) => {
                    if (result && this.lastRequest.id === id) {
                        if ((result as NodeServicePageFilesResponse).total >= 0) {
                            this.files = (result as NodeServicePageFilesResponse).value;
                            this.total = (result as NodeServicePageFilesResponse).total;
                        } else if (result instanceof Array) {
                            this.files = result as DesignData[];
                        }

                        if (
                            !this.apiPagination ||
                            page === 1 ||
                            !this.identicalFilesLoadRequests(this.lastRequest, this.lastSuccessfulRequest)
                        ) {
                            this.resetPaginator();
                        }
                        this.notFound = this.files.length === 0;

                        this.lastSuccessfulRequest = { id, node, page, files: this.files };
                    }
                })
                .catch((err) => {
                    console.warn(err);
                    this.notFound = this.files.length === 0;
                })
                .finally(() => {
                    if (this.lastRequest.id === id) {
                        // select again, cause few load processes may be launched
                        this.selectNode(node);
                        this.isLoadingFiles = false;
                        this.updCrumbs();
                    }
                });

            this.nodeDescription = category.description;
        } else {
            node.expanded = !node.expanded;
        }
    }

    selectNode(node: TreeNode) {
        this.selectedNode = node;
        this.selectedNodeChange.emit(node);
    }

    onSearch(str: any, page: number = 1, categoryID: string = null) {
        if (!this.apiPagination) {
            this.removeFilter();
        }

        let id: string = Math.floor(Math.random() * 10000000).toString();
        let newRequest = { id, isSearch: true, searchStr: str, searchCategoryID: categoryID, page };

        if (this.compactLayout) {
            this.files = [];
            this.notFound = false;
        }
        if (!categoryID) {
            this.selectNode(this.searchNode);
        }
        this.isLoadingFiles = true;
        this.updCrumbs();

        this.lastRequest = newRequest;

        let params: any[] = [str, true, this.types];
        if (this.apiPagination) {
            params.push(page, this.itemsPerPage, categoryID);
        }

        this.nodeService.getFiles
            .apply(this.nodeService, params)
            .then((result) => {
                if (result && this.lastRequest.id === id) {
                    if ((result as NodeServicePageFilesResponse).total >= 0) {
                        this.files = (result as NodeServicePageFilesResponse).value;
                        this.total = (result as NodeServicePageFilesResponse).total;
                    } else if (result instanceof Array) {
                        this.files = result as DesignData[];
                    }

                    if (
                        !this.apiPagination ||
                        page === 1 ||
                        !this.identicalFilesLoadRequests(this.lastRequest, this.lastSuccessfulRequest)
                    ) {
                        this.resetPaginator();
                    }
                    this.notFound = this.files.length === 0;

                    this.lastSuccessfulRequest = {
                        id,
                        isSearch: true,
                        searchStr: str,
                        searchCategoryID: categoryID,
                        page,
                        files: this.files
                    };
                }
            })
            .catch((err) => {
                console.warn(err);
                this.notFound = this.files.length === 0;
            })
            .finally(() => {
                if (this.lastRequest.id === id) {
                    if (!categoryID) {
                        // select again, cause few load processes may be launched
                        this.selectNode(this.searchNode);
                    }
                    this.isLoadingFiles = false;
                    this.updCrumbs(true);
                }
            });
    }

    onSearchKeyDown(event: any, str: string) {
        if (event.keyCode == 13 || event.key === 'Enter') {
            this.onSearch(str);
        }
    }

    onSubSearch(str: string, page: number = 1) {
        if (this.selectedNode && this.selectedNode.label !== this.searchNode.label) {
            if (this.apiPagination) {
                const categoryID: string = this.selectedNode ? (this.selectedNode.data as DesignDataCategory).catID : null;
                this.onSearch(str, page, categoryID);
            } else {
                // simple filtering in the files
                if (this.compactLayout) {
                    this.files = this.lastSuccessfulRequest.files.filter(
                        (elem) => (elem.title && elem.title.indexOf(str) >= 0) || (elem.name && elem.name.indexOf(str) >= 0)
                    );
                }

                if (this.dv) {
                    this.dv.filter(str, 'contains');
                }
            }

            this.updCrumbs(true);
        } else {
            this.msgService.add({ severity: 'info', summary: 'Please select a folder first', detail: '' });
        }
    }

    cancelLoading() {
        if (this.isLoadingFiles) {
            this.lastRequest.id = '-1';
            this.isLoadingFiles = false;
        }
    }

    identicalFilesLoadRequests(req1: FilesLoadRequest, req2: FilesLoadRequest, comparePage: boolean = false) {
        return (
            req1.id &&
            req2.id &&
            req1.node === req2.node &&
            req1.isSearch === req2.isSearch &&
            req1.searchStr === req2.searchStr &&
            req1.searchCategoryID === req2.searchCategoryID &&
            (!comparePage || req1.page === req2.page)
        );
    }

    onFileSelect(event: Event, file: DesignData) {
        if (!file) {
            return;
        }

        this.retainState = true;

        this.onSelect.emit(file);
    }

    onFileContextMenu(event: any, file: DesignData) {
        if (!file) {
            return;
        }

        this.onRightClick.emit(file);
        return false;
    }

    onShowPreview(event: any, element: DesignData, opPreview: any) {
        if (this.visible && element && (element.thumbnail || element.image || element.fullImage)) {
            this.hoverImage = element;
            opPreview.show(event);
        }
    }

    onHidePreview(event: any, opPreview: any) {
        this.hoverImage = null;
        opPreview.hide(event);
    }

    updateUploadID() {
        this.uploadID = Math.floor(Math.random() * 10000000000);
    }

    onFileUpload(event: any) {
        let isArt: boolean = this.nodeService instanceof ArtService; // otherwise is background

        // array's length is 1 always in our case
        let uploadedFiles: any[] = event.originalEvent.body.files; // if primeng <= 7.0.4 JSON.parse(event.xhr.response).files

        if (uploadedFiles) {
            let file: DesignData;
            for (let uf of uploadedFiles) {
                let shortName: string = StrUtils.getFileName(uf.name, true); // cutting off the extension
                let ext: string = StrUtils.getExtension(uf.name, false).toLowerCase();
                //let src: string = shortName + ext; // folder/folder/image.PNG -> image.png

                if (isArt) {
                    file = ArtService.createArtData();
                    // all user images uploaded as a component at the moment
                    file.type = ArtService.ART_TYPE_COMPONENT;
                    file.title = shortName;
                    file.image = this.config.uploadedFilesURL + (this.config.production ? this.uploadID : shortName) + ext;
                } else {
                    file = BackgroundService.createBackgroundData();
                    file.type = BackgroundService.BACKGROUND_TYPE_STANDARD;
                    file.title = file.name = shortName;
                    file.fullImage = this.config.uploadedFilesURL + (this.config.production ? this.uploadID : shortName) + ext;
                }

                if (this.config.production) {
                    // generate a thumbnail
                    let img: HTMLImageElement = new Image();
                    let src: string = isArt ? file.image : file.fullImage;
                    img.src = this.config.getAssetFullURL(src);
                    img.onload = () => {
                        file.thumbnail = CanvasUtils.generateThumbnail(img, 0, 0, img.width, img.height, 50, 50, true, '#ffffff');
                    };
                } else {
                    file.thumbnail = this.config.uploadedFilesURL + 'thumbnail/' + shortName + ext;
                }

                if (isArt) {
                    if (this.types.find((element) => element === ArtService.ART_TYPE_VASE)) {
                        // uploaded in the Add Vase section
                        file.style = ArtService.STYLE_SIMPLE;
                    }
                }
            }

            if (file) {
                this.onSelect.emit(file);
            } else {
                this.msgService.add({ severity: 'error', summary: 'Empty File', detail: '' });
            }
        } else {
            this.msgService.add({ severity: 'error', summary: 'Empty Response', detail: '' });
        }

        this.updateUploadID();
    }

    onFileLoadError = (error?: any) => {
        console.warn('Error:', error);
        this.msgService.add({ severity: 'error', summary: "Can't load file(s)", detail: '' });
    };

    onFileUploadError = (error?: any) => {
        console.warn('Error:', error);
        this.msgService.add({ severity: 'error', summary: "Can't upload file(s)", detail: '' });
        this.updateUploadID();
    };

    onFileRemove(file: DesignData) {
        if (this.isRemovingFiles) {
            return;
        }

        let title: string = file.title ? file.title : file.name;
        this.confirmationService.confirm({
            message: 'Do you want to delete "' + title + '"?',
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.removeFile(file);
            }
        });
    }

    removeFile = (file: DesignData) => {
        if (this.isRemovingFiles) {
            return;
        }
        this.isRemovingFiles = true;
        this.nodeService
            .removeFile(file)
            .then((result) => {
                if (result) {
                    // successful deletion
                    let i: number = this.files.indexOf(file);
                    if (i >= 0) {
                        this.files.splice(i, 1);
                    }

                    this.onRemove.emit(file);

                    this.msgService.add({ severity: 'success', summary: 'Successfully removed', detail: '' });
                }
            })
            .catch((err) => {
                console.warn(err);
                this.msgService.add({ severity: 'error', summary: 'Error', detail: err.message });
            })
            .finally(() => {
                this.isRemovingFiles = false;
            });
    };

    onSaveKeyDown(event: any, str: string) {
        if (event.keyCode == 13 || event.key === 'Enter') {
            this.onFileSave(str);
        }
    }

    async onFileSave(title: string) {
        if (this.isSavingFiles) {
            return;
        }

        title = title.trim();
        if (!title) {
            this.msgService.add({ severity: 'error', summary: 'Invalid Name', detail: '' });
            return;
        }

        let categoryID: string = this.selectedNode ? (this.selectedNode.data as DesignDataCategory).catID : null;
        if (!categoryID) {
            this.msgService.add({ severity: 'error', summary: 'Undefined category', detail: 'Please select a category' });
            return;
        }

        let sameNameFile: DesignData = this.files.find((elem) => elem.title === title || elem.name === title);
        let existingID: string;

        if (sameNameFile) {
            existingID = sameNameFile.id;
        } else {
            // check on a remote server as well
            if (this.apiPagination && !sameNameFile) {
                existingID = await this.nodeService.getSameFileNameID(title, categoryID);
            }
        }

        if (existingID) {
            // ask permission to update the existing record
            this.confirmationService.confirm({
                message: 'Replace previously saved "' + title + '"?',
                header: 'Replace Confirmation',
                icon: 'pi pi-exclamation-triangle',
                accept: () => {
                    this.saveFile(title, existingID, categoryID);
                }
            });
        } else {
            // create a new record
            this.saveFile(title, '', categoryID);
        }
    }

    saveFile = (title: string, id?: string, categoryID?: string) => {
        if (this.isSavingFiles) {
            return;
        }

        let file: DesignData = this.fileToSave;
        if (!file) {
            return;
        }

        this.isSavingFiles = true;
        this.nodeService
            .saveFile(file, title, id, categoryID)
            .then((result) => {
                if (result) {
                    // successfully saved
                    this.files.unshift(file); // TODO: if files will be visible during saving, a case when replacing happens must be taken into account

                    this.onSave.emit(file);

                    this.msgService.add({ severity: 'success', summary: 'Successfully saved', detail: '' });
                }
            })
            .catch((err) => {
                console.warn(err);
                this.msgService.add({ severity: 'error', summary: 'Error', detail: err.message });
            })
            .finally(() => {
                this.isSavingFiles = false;
            });
    };

    isBase64String(str: string) {
        return StrUtils.isBase64String(str);
    }

    onHide() {
        if (!this.retainState || !this.retainStateAllowed) {
            // clearing forces the files loading when this component gets visible again
            this.clear();
        }
    }

    resetPaginator = () => {
        this.isResettingPaginator = true;

        setTimeout(() => {
            if (this.dv) {
                // a better way of resetting may be present, though [(first)]="first" doesn't work somehow in the DataView
                this.dv.sort();
            }
            setTimeout(() => {
                this.isResettingPaginator = false;
            });
        });
    };

    removeFilter() {
        if (this.dv) {
            this.dv.filter('');
        }
    }

    clear() {
        this.cancelLoading();
        this.files = [];
        this.notFound = false;
        this.selectNode(null);
        this.updCrumbs();
    }
}
