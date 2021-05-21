import { NgModule } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
// TODO : put some modules into the shared module
import { FormsModule } from '@angular/forms';
import { SpaceComponent } from './space/space.component';
import { DesignerComponent } from './designer/designer.component';

import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { SplitButtonModule } from 'primeng/splitbutton';
import { InputTextModule } from 'primeng/inputtext';
import { BlockUIModule } from 'primeng/blockui';
import { DialogModule } from 'primeng/dialog';
import { DataViewModule } from 'primeng/dataview';
import { FileUploadModule } from 'primeng/fileupload';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { SpinnerModule } from 'primeng/spinner';
import { TreeModule } from 'primeng/tree';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { CarouselModule } from 'primeng/carousel';
import { ContextMenuModule } from 'primeng/contextmenu';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SidebarModule } from 'primeng/sidebar';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DragDropModule } from 'primeng/dragdrop';
import { VirtualScrollerModule } from 'primeng/virtualscroller';
import { MessagesModule } from 'primeng/messages';
import { MessageModule } from 'primeng/message';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ScrollPanelModule } from 'primeng/scrollpanel';

import { MessageService, ConfirmationService } from 'primeng/api';
import { VerticalToolbarComponent } from './vertical-toolbar/vertical-toolbar.component';
import { PathNamePipe } from './shared/pipes/path-name.pipe';
import { SafePipe } from './shared/pipes/safe.pipe';
import { LibraryComponent } from './library/library.component';
import { TopToolbarComponent } from './top-toolbar/top-toolbar.component';
import { BottomToolbarComponent } from './bottom-toolbar/bottom-toolbar.component';

@NgModule({
    declarations: [
        SpaceComponent,
        DesignerComponent,
        VerticalToolbarComponent,
        PathNamePipe,
        SafePipe,
        LibraryComponent,
        TopToolbarComponent,
        BottomToolbarComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        SliderModule,
        CheckboxModule,
        AccordionModule,
        ToggleButtonModule,
        SplitButtonModule,
        InputTextModule,
        BlockUIModule,
        DialogModule,
        DataViewModule,
        FileUploadModule,
        DropdownModule,
        ToastModule,
        TooltipModule,
        MenuModule,
        MenubarModule,
        SpinnerModule,
        TreeModule,
        OverlayPanelModule,
        CarouselModule,
        ContextMenuModule,
        ConfirmDialogModule,
        SidebarModule,
        SelectButtonModule,
        InputTextareaModule,
        DragDropModule,
        VirtualScrollerModule,
        MessagesModule,
        MessageModule,
        BreadcrumbModule,
        ScrollPanelModule
    ],
    providers: [MessageService, ConfirmationService]
})
export class DesignerModule {}
