import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DesignerComponent } from './designer/designer/designer.component';

// Router is not used cause Ruby on Rails has some routing mechanism too which altogether with Angular's router
// affects browser's back and forward buttons badly
const routes: Routes = [
    { path: '', component: DesignerComponent /*, canActivate: [UnAuthGuardService]*/ }
    //{ path: 'designer', loadChildren: './designer/designer.module#DesignerModule' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {}
