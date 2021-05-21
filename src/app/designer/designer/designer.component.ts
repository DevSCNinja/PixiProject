import { Component, OnInit } from '@angular/core';
import { DesignService } from '../shared/services/design.service';
import { UIService } from '../shared/services/ui.service';

@Component({
    selector: 'app-root',
    templateUrl: './designer.component.html',
    styleUrls: ['./designer.component.scss']
})
export class DesignerComponent implements OnInit {
    constructor(public ds: DesignService, public ui: UIService) {}

    ngOnInit() {}
}
