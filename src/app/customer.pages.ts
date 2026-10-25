import {Component,inject,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink} from '@angular/router';
import {IonicModule} from '@ionic/angular';
import {ApiService,StoreService,Order} from './store.service';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonicModule],templateUrl:'./cart.page.html'})
export class CartPage{store=inject(StoreService);}
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonicModule],templateUrl:'./account.page.html'})
export class AccountPage{
 store=inject(StoreService);api=inject(ApiService);router=inject(Router);
 registerMode=false;busy=false;error='';name='';email='';password='';
 submit(){
  if(this.busy)return;this.busy=true;this.error='';
  const request=this.registerMode?this.api.register({name:this.name,email:this.email,password:this.password}):this.api.login({email:this.email,password:this.password});
  request.subscribe({next:r=>{this.store.login(r.token,r.user);this.busy=false;this.router.navigateByUrl(r.user.role==='admin'?'/admin':'/orders');},
   error:e=>{this.error=e.error?.error||'Could not sign in. Please check your details.';this.busy=false;}});
 }
 logout(){this.store.logout();this.store.notify('Signed out');}
 fillDemo(role:'admin'|'shopper'){this.email=role==='admin'?'admin@kasidrop.test':'shopper@kasidrop.test';this.password='Demo@12345';this.registerMode=false;}
}
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonicModule],templateUrl:'./checkout.page.html'})
export class CheckoutPage implements OnInit{
 api=inject(ApiService);store=inject(StoreService);router=inject(Router);
 delivery={name:'',phone:'',address:'',city:'',province:'Gauteng',postalCode:''};
 method:'demo'|'payfast'='demo';demo=true;busy=false;error='';
 ngOnInit(){this.api.meta().subscribe({next:m=>{this.demo=m.demoMode;this.method=m.demoMode?'demo':'payfast';},error:()=>this.error='Checkout service is unavailable.'});}
 submit(){
  if(this.busy||!this.store.selectedCart().length||!this.store.user())return;
  this.busy=true;this.error='';
  const items=this.store.selectedCart().map(l=>({productId:l.product.id,quantity:l.quantity}));
  this.api.checkout({items,paymentMethod:this.method,delivery:this.delivery}).subscribe({
   next:r=>{
    if(r.payment){const form=document.createElement('form');form.action=r.payment.url;form.method='POST';
     for(const [name,value] of Object.entries(r.payment.fields)){const field=document.createElement('input');field.type='hidden';field.name=name;field.value=value;form.appendChild(field);}
     document.body.appendChild(form);form.submit();return;}
    this.store.clearSelected();this.store.notify(r.warning||'Your order has been placed!');this.router.navigateByUrl('/orders');this.busy=false;
   },error:e=>{this.error=e.error?.error||'Could not process checkout. Please retry.';this.busy=false;}
  });
 }
}
@Component({standalone:true,imports:[CommonModule,RouterLink,IonicModule],templateUrl:'./orders.page.html'})
export class OrdersPage implements OnInit{
 store=inject(StoreService);api=inject(ApiService);orders:Order[]=[];loading=true;error='';
 ngOnInit(){if(this.store.user())this.api.orders().subscribe({next:r=>{this.orders=r.orders;this.loading=false;},error:()=>{this.error='Could not load orders.';this.loading=false;}});else this.loading=false;}
}
