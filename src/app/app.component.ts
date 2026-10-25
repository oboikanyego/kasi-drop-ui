import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink,RouterLinkActive,RouterOutlet} from '@angular/router';
import {IonicModule} from '@ionic/angular';
import {addIcons} from 'ionicons';
import {homeOutline,home,gridOutline,grid,bagHandleOutline,bagHandle,heartOutline,heart,personCircleOutline,personCircle,searchOutline,arrowForwardOutline,chevronForwardOutline,chevronBackOutline,informationCircleOutline,locationOutline,notificationsOutline,giftOutline,flameOutline,leafOutline,cafeOutline,shirtOutline,colorPaletteOutline,cubeOutline,arrowBackOutline,shareOutline,addOutline,removeOutline,ellipsisHorizontalOutline,trashOutline,checkmarkOutline,sparklesOutline,closeOutline,sendOutline,logOutOutline,personOutline,storefrontOutline,optionsOutline,checkmarkCircleOutline,menuOutline} from 'ionicons/icons';
import {ApiService,StoreService} from './store.service';

addIcons({homeOutline,home,gridOutline,grid,bagHandleOutline,bagHandle,heartOutline,heart,personCircleOutline,personCircle,searchOutline,arrowForwardOutline,chevronForwardOutline,chevronBackOutline,locationOutline,notificationsOutline,giftOutline,flameOutline,leafOutline,cafeOutline,shirtOutline,colorPaletteOutline,cubeOutline,arrowBackOutline,shareOutline,addOutline,removeOutline,ellipsisHorizontalOutline,trashOutline,checkmarkOutline,sparklesOutline,closeOutline,sendOutline,logOutOutline,personOutline,storefrontOutline,optionsOutline,checkmarkCircleOutline,menuOutline});

@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,RouterLink,RouterLinkActive,RouterOutlet,IonicModule],templateUrl:'./app.component.html'})
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
