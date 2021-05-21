import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// TODO: setup this shared module
//import { FormsModule}    from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
    declarations: [],
    imports: [CommonModule],
    exports: [/*FormsModule,*/ HttpClientModule, BrowserAnimationsModule]
})
export class SharedModule {}
