import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink,RouterLinkActive,RouterOutlet} from '@angular/router';
import { IonApp, IonContent, IonIcon } from '@ionic/angular/standalone';
import {ApiService,StoreService} from './store.service';


@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,RouterLink,RouterLinkActive,RouterOutlet,IonApp,IonContent,IonIcon],templateUrl:'./app.component.html',styleUrls:['./preview-status.scss']})
export class AppComponent {
 readonly store=inject(StoreService);
 readonly api=inject(ApiService);
 readonly router=inject(Router);
 search='';
 chatOpen=signal(false);
 chatText='';
 thinking=signal(false);
 chatMessages=signal<{from:'bot'|'user';text:string}[]>([{from:'bot',text:'Sawubona! Tell me what you are shopping for and I will search KasiDrop for real local finds.'}]);
 searchNow(){this.router.navigate(['/shop'],{queryParams:this.search.trim()?{q:this.search.trim()}: {}});}
 sendChat(){
  const message=this.chatText.trim();
  if(!message||this.thinking())return;
  this.chatMessages.update(items=>[...items,{from:'user',text:message}]);this.chatText='';this.thinking.set(true);
  this.api.chat(message).subscribe({
   next:result=>{
    this.chatMessages.update(items=>[...items,{from:'bot',text:result.reply}]);
    for(const action of result.cartActions){const product=result.products.find(p=>p.id===action.productId);if(product)this.store.add(product,action.quantity);}
    this.thinking.set(false);
   },
   error:()=>{this.chatMessages.update(items=>[...items,{from:'bot',text:'I cannot connect right now. The catalogue is still open for browsing.'}]);this.thinking.set(false);}
  });
 }
}
