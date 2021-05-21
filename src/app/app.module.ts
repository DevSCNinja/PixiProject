import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { DesignerComponent } from './designer/designer/designer.component';

import { SharedModule } from './shared/shared.module';
import { DesignerModule } from './designer/designer.module';

@NgModule({
    declarations: [AppComponent],
    imports: [BrowserModule, HttpClientModule, SharedModule, DesignerModule],
    providers: [],
    bootstrap: [DesignerComponent]
})
export class AppModule {}
