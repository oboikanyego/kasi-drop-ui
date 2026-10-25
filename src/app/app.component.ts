import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink,RouterLinkActive,RouterOutlet} from '@angular/router';
import {IonicModule} from '@ionic/angular';
import {ApiService,StoreService} from './store.service';
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,RouterLink,RouterLinkActive,RouterOutlet,IonicModule],templateUrl:'./app.component.html'})
export class AppComponent{
 store=inject(StoreService);api=inject(ApiService);router=inject(Router);
 search='';chatOpen=signal(false);chatText='';thinking=signal(false);
 chatMessages=signal<{from:'bot'|'user';text:string}[]>([{from:'bot',text:'Sawubona! 👋 I can help you find local gifts and lekker everyday essentials. What are you looking for?'}]);
 searchNow(){this.router.navigate(['/shop'],{queryParams:this.search.trim()?{q:this.search.trim()}: {}});}
 logout(){this.store.logout();this.router.navigate(['/']);this.store.notify('Signed out');}
 sendChat(){
  const message=this.chatText.trim();if(!message||this.thinking())return;
  this.chatMessages.update(items=>[...items,{from:'user',text:message}]);this.chatText='';this.thinking.set(true);
  this.api.chat(message).subscribe({next:result=>{
   this.chatMessages.update(items=>[...items,{from:'bot',text:result.reply}]);
   for(const action of result.cartActions){const product=result.products.find(p=>p.id===action.productId);if(product)this.store.add(product,action.quantity);}
   this.thinking.set(false);
  },error:()=>{this.chatMessages.update(items=>[...items,{from:'bot',text:'Our shopping helper is offline right now. You can still explore the shop!'}]);this.thinking.set(false);}});
 }
}
