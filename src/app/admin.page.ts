import {Component,inject,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {IonicModule} from '@ionic/angular';
import {ApiService,StoreService,Product,Order} from './store.service';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonicModule],templateUrl:'./admin.page.html'})
export class AdminPage implements OnInit{
 api=inject(ApiService);store=inject(StoreService);
 tab:'overview'|'products'|'orders'|'add'='overview';summary?:{products:number;lowStock:number;orders:number;demoOrders:number;revenue:number;simulatedRevenue:number;recentOrders:Order[]};
 products:Product[]=[];orders:Order[]=[];busy=false;error='';notice='';
 form={name:'',description:'',category:'Crafts',price:199,stock:10,image:'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800',tags:'local, handmade',featured:false,active:true};
 notes='';generating=false;
 ngOnInit(){if(this.store.user()?.role==='admin')this.refresh();}
 refresh(){this.api.adminSummary().subscribe({next:r=>this.summary=r,error:()=>this.error='Could not load admin summary.'});this.api.getProducts().subscribe({next:r=>this.products=r.products});this.api.adminOrders().subscribe({next:r=>this.orders=r.orders});}
 stockChange(p:Product,n:number){if(!Number.isInteger(n)||n<0)return;this.api.updateProduct(p.id,{stock:n}).subscribe({next:r=>{p.stock=r.product.stock;this.notice='Stock updated';this.refresh();},error:()=>this.error='Could not save stock.'});}
 setStatus(order:Order,status:string){this.api.setOrderStatus(order.id,status).subscribe({next:()=>{order.status=status;this.notice='Order updated';this.refresh();},error:e=>this.error=e.error?.error||'Could not update order'});}
 add(){this.busy=true;this.error='';this.api.createProduct({...this.form,tags:this.form.tags.split(',').map(x=>x.trim()).filter(Boolean)}).subscribe({next:()=>{this.busy=false;this.notice='Product published';this.tab='products';this.refresh();},error:e=>{this.busy=false;this.error=e.error?.error||'Could not save product';}});}
 generate(){this.generating=true;this.error='';this.api.draftListing({name:this.form.name||'New local product',notes:this.notes,category:this.form.category}).subscribe({next:r=>{this.form.name=r.draft.title;this.form.description=r.draft.description;this.form.tags=r.draft.tags.join(', ');this.notice='AI draft created — review before saving';this.generating=false;},error:e=>{this.error=e.error?.error||'AI drafting unavailable. Configure the Claude API key.';this.generating=false;}});}
}
