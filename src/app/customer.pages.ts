import {Component,inject,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink} from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { IonIcon } from '@ionic/angular/standalone';
import {ApiService,StoreService,type SavedAddress} from './store.service';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonIcon],templateUrl:'./cart.page.html'})
export class CartPage{store=inject(StoreService);api=inject(ApiService);}
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonicModule],templateUrl:'./checkout.page.html',styleUrls:['./profile-page.scss']})
export class CheckoutPage implements OnInit{
 api=inject(ApiService);store=inject(StoreService);router=inject(Router);
 delivery={name:'',phone:'',address:'',city:'',province:'Gauteng',postalCode:''};
 savedAddresses:SavedAddress[]=[];
 selectedAddressId='manual';
 profileName='';profilePhone='';
 addressLoading=false;
 method:'demo'|'payfast'='demo';demo=true;busy=false;error='';
 ngOnInit(){
  this.api.meta().subscribe({next:m=>{
   this.demo=m.demoMode;this.method=m.demoMode?'demo':'payfast';
  },error:()=>this.error='Checkout service is unavailable.'});
  if(this.store.user()){
   this.addressLoading=true;
   this.api.getProfile().subscribe({
    next:({profile})=>{
     this.savedAddresses=profile.addresses;
     this.profileName=profile.name;this.profilePhone=profile.phone;
     const preferred=profile.addresses.find(a=>a.isDefault);
     this.selectedAddressId=preferred?.id||'manual';
     this.onAddressSelected();
     this.addressLoading=false;
    },
    error:()=>{this.addressLoading=false;this.delivery.name=this.store.user()?.name||'';}
   });
  }
 }
 onAddressSelected(){
  const found=this.savedAddresses.find(address=>address.id===this.selectedAddressId);
  if(!found){
   this.delivery={name:this.profileName||this.store.user()?.name||'',phone:this.profilePhone,
    address:'',city:'',province:'Gauteng',postalCode:''};
   return;
  }
  this.delivery={
   name:found.recipientName,phone:found.phone,
   address:found.unit?found.unit+', '+found.street:found.street,
   city:found.city,province:found.province,postalCode:found.postalCode
  };
 }
 submit(){
  if(this.api.previewMode()){this.error='Checkout is disabled while the catalogue is in offline preview mode.';return;}
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
