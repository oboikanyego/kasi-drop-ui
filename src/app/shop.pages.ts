import {Component,inject,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink,ActivatedRoute} from '@angular/router';
import {IonicModule} from '@ionic/angular';
import {ApiService,Product,StoreService} from './store.service';
import {ProductGridComponent} from './product-grid.component';
@Component({standalone:true,imports:[CommonModule,RouterLink,ProductGridComponent,IonicModule],templateUrl:'./home.page.html'})
export class HomePage implements OnInit{
 api=inject(ApiService);featured:Product[]=[];loading=true;error='';
 ngOnInit(){this.api.getProducts().subscribe({next:r=>{this.featured=r.products.filter(p=>p.featured).slice(0,8);this.loading=false;},error:()=>{this.error='Products could not load. The demo API may be waking up.';this.loading=false;}});}
}
@Component({standalone:true,imports:[CommonModule,RouterLink,ProductGridComponent,FormsModule,IonicModule],templateUrl:'./shop.page.html'})
export class ShopPage implements OnInit{
 api=inject(ApiService);route=inject(ActivatedRoute);products:Product[]=[];categories=['All','Food & Drink','Fashion','Home & Living','Crafts'];category='All';q='';sort='featured';maxPrice=0;loading=true;error='';
 ngOnInit(){this.route.queryParamMap.subscribe(params=>{this.category=params.get('category')||'All';this.q=params.get('q')||'';this.load();});}
 load(){this.loading=true;const params=new URLSearchParams();if(this.q)params.set('q',this.q);if(this.category!=='All')params.set('category',this.category);if(this.sort!=='featured')params.set('sort',this.sort);if(this.maxPrice>0)params.set('maxPrice',String(this.maxPrice));
 this.api.getProducts('?'+params.toString()).subscribe({next:r=>{this.products=r.products;this.error='';this.loading=false;},error:()=>{this.error='We could not reach the shop API. Please try again shortly.';this.loading=false;}});}
 setCategory(c:string){this.category=c;this.load();}
}
@Component({standalone:true,imports:[CommonModule,RouterLink,ProductGridComponent,IonicModule],templateUrl:'./product.page.html'})
export class ProductPage implements OnInit{
 api=inject(ApiService);store=inject(StoreService);route=inject(ActivatedRoute);product?:Product;similar:Product[]=[];quantity=1;error='';
 ngOnInit(){this.route.paramMap.subscribe(params=>{const id=params.get('id');if(id)this.api.getProduct(id).subscribe({next:r=>{this.product=r.product;this.similar=r.similar;this.quantity=1;this.error='';},error:()=>this.error='Product not found.'});});}
 adjust(n:number){if(this.product)this.quantity=Math.max(1,Math.min(20,this.product.stock,this.quantity+n));}
}
