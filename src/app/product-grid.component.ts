import {Component,Input,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {IonicModule} from '@ionic/angular';
import {Product,StoreService} from './store.service';
@Component({selector:'app-product-grid',standalone:true,imports:[CommonModule,RouterLink,IonicModule],templateUrl:'./product-grid.component.html'})
export class ProductGridComponent{
 @Input({required:true})products:Product[]=[];
 store=inject(StoreService);
 imageError(event:Event){const element=event.target as HTMLImageElement;element.onerror=null;element.src='https://placehold.co/800x700/e8ebe5/426359?text=KasiDrop';}
}
