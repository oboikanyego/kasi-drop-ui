import {Injectable,computed,signal,inject} from '@angular/core';
import {HttpClient,HttpInterceptorFn} from '@angular/common/http';
import {catchError,of,tap,throwError,timeout} from 'rxjs';
import {previewProducts,searchPreview} from './preview-catalogue';
export type Product={id:string;name:string;description:string;category:string;price:number;stock:number;image:string;tags:string[];featured:boolean;active:boolean};
export type CartLine={product:Product;quantity:number};
export type PurchasedLine={productId:string;quantity:number};
export type PendingCheckout={orderId:string;userId:string;items:PurchasedLine[]};

export type AddressLabel='Home'|'Work'|'Other';
export type SavedAddress={
 id:string;label:AddressLabel;nickname:string;recipientName:string;phone:string;
 street:string;unit:string;suburb:string;city:string;province:string;postalCode:string;
 deliveryNotes:string;isDefault:boolean;
};
export type AddressInput=Omit<SavedAddress,'id'>;
export type CustomerProfile={
 id:string;name:string;email:string;role:'customer'|'admin';phone:string;about:string;
 preferredLanguage:string;marketingOptIn:boolean;memberSince:string|null;
 avatarUpdatedAt:string|null;addresses:SavedAddress[];
};
export type ProfileUpdate=Pick<CustomerProfile,'name'|'phone'|'about'|'preferredLanguage'|'marketingOptIn'>;
export type User={id:string;name:string;email:string;role:'customer'|'admin'};
export type Order={id:string;items:{productId:string;name:string;price:number;quantity:number;image:string}[];total:number;subtotal:number;shipping:number;status:string;createdAt:string;demoSeed?:boolean;delivery:{name:string;address:string;city:string}};
export const authInterceptor:HttpInterceptorFn=(req,next)=>{
 const token=typeof localStorage==='undefined'?'':localStorage.getItem('kasi_token');
 return next(token?req.clone({setHeaders:{Authorization:'Bearer '+token}}):req);
};
@Injectable({providedIn:'root'})
export class StoreService{
 readonly cart=signal<CartLine[]>(this.restore<CartLine[]>('kasi_cart',[]));
 readonly user=signal<User|null>(this.restore<User|null>('kasi_user',null));
 readonly favorites=signal<string[]>(this.restore<string[]>('kasi_favorites',[]));
 readonly selectedIds=signal<string[]>(this.restore<string[]>('kasi_selected',this.cart().map(l=>l.product.id)));
 readonly selectedCart=computed(()=>this.cart().filter(l=>this.selectedIds().includes(l.product.id)));
 readonly allSelected=computed(()=>this.cart().length>0&&this.cart().every(l=>this.selectedIds().includes(l.product.id)));
 readonly selectedCount=computed(()=>this.selectedCart().reduce((n,l)=>n+l.quantity,0));
 readonly count=computed(()=>this.cart().reduce((n,x)=>n+x.quantity,0));
 readonly subtotal=computed(()=>this.selectedCart().reduce((n,x)=>n+x.product.price*x.quantity,0));
 readonly shipping=computed(()=>this.subtotal()>=750||this.subtotal()===0?0:79);
 readonly total=computed(()=>this.subtotal()+this.shipping());
 toast=signal('');
 private restore<T>(key:string,initial:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??initial}catch{return initial}}
 add(product:Product,quantity=1){
  if(product.stock<1){this.notify('This item is out of stock');return;}
  this.cart.update(lines=>{const found=lines.find(l=>l.product.id===product.id);
   if(found)return lines.map(l=>l.product.id===product.id?{...l,quantity:Math.min(l.quantity+quantity,product.stock,20)}:l);
   return [...lines,{product,quantity:Math.min(quantity,product.stock,20)}];});
  this.selectedIds.update(ids=>ids.includes(product.id)?ids:[...ids,product.id]);
  this.persist();this.notify(product.name+' added to your bag');
 }
 update(id:string,quantity:number){this.cart.update(lines=>lines.map(l=>l.product.id===id?{...l,quantity:Math.max(1,Math.min(quantity,l.product.stock,20))}:l));this.persist();}
 remove(id:string){this.cart.update(lines=>lines.filter(l=>l.product.id!==id));this.selectedIds.update(ids=>ids.filter(x=>x!==id));this.persist();}
 clear(){this.cart.set([]);this.selectedIds.set([]);this.persist();}
 clearSelected(){const selected=new Set(this.selectedIds());this.cart.update(lines=>lines.filter(l=>!selected.has(l.product.id)));this.selectedIds.set([]);this.persist();}
 /** Never clear on redirect; store a per-account purchase snapshot until backend confirms payment. */
 rememberPendingCheckout(orderId:string,items:PurchasedLine[]){
  const userId=this.user()?.id;
  if(!userId||!orderId||items.length===0)return;
  sessionStorage.setItem('kasi_pending_checkout',JSON.stringify({orderId,userId,items}));
 }
 pendingCheckout():PendingCheckout|null{
  try{
   const data=JSON.parse(sessionStorage.getItem('kasi_pending_checkout')||'null') as PendingCheckout|null;
   if(!data||data.userId!==this.user()?.id||typeof data.orderId!=='string'||!Array.isArray(data.items))return null;
   if(!data.items.every(x=>typeof x.productId==='string'&&Number.isInteger(x.quantity)&&x.quantity>0))return null;
   return data;
  }catch{return null;}
 }
 /** Run only after matching backend order is verified paid. Preserve unchecked/newly-added quantities. */
 completeVerifiedCheckout(order:Order):boolean{
  const pending=this.pendingCheckout();
  if(!pending||pending.orderId!==order.id||!['paid','processing','shipped','delivered','demo_paid'].includes(order.status))return false;
  this.cart.update(lines=>lines.flatMap(line=>{
   const purchased=pending.items.find(item=>item.productId===line.product.id);
   if(!purchased)return [line];
   const left=line.quantity-purchased.quantity;
   return left>0?[{...line,quantity:left}]:[];
  }));
  const remaining=new Set(this.cart().map(line=>line.product.id));
  this.selectedIds.update(ids=>ids.filter(id=>remaining.has(id)));
  this.persist();
  sessionStorage.removeItem('kasi_pending_checkout');
  this.notify('Payment confirmed — purchased items removed from your bag.');
  return true;
 }
 isFavorite(id:string){return this.favorites().includes(id);}
 toggleFavorite(id:string){this.favorites.update(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);localStorage.setItem('kasi_favorites',JSON.stringify(this.favorites()));this.notify(this.isFavorite(id)?'Saved to favourites':'Removed from favourites');}
 isSelected(id:string){return this.selectedIds().includes(id);}
 toggleSelected(id:string){this.selectedIds.update(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);this.persist();}
 selectAll(enabled:boolean){this.selectedIds.set(enabled?this.cart().map(x=>x.product.id):[]);this.persist();}
 login(token:string,user:User){localStorage.setItem('kasi_token',token);localStorage.setItem('kasi_user',JSON.stringify(user));this.user.set(user);}
 updateAccountName(name:string){
  const user=this.user();if(!user)return;
  const updated={...user,name};
  this.user.set(updated);localStorage.setItem('kasi_user',JSON.stringify(updated));
 }
 logout(){localStorage.removeItem('kasi_token');localStorage.removeItem('kasi_user');sessionStorage.removeItem('kasi_pending_checkout');this.user.set(null);}
 notify(message:string){this.toast.set(message);setTimeout(()=>{if(this.toast()===message)this.toast.set('')},3000);}
 private persist(){localStorage.setItem('kasi_cart',JSON.stringify(this.cart()));localStorage.setItem('kasi_selected',JSON.stringify(this.selectedIds()));}
}
@Injectable({providedIn:'root'})
export class ApiService{
 private http=inject(HttpClient);
 private readonly base='/api';
 /** A failed API request switches catalogue browsing into explicitly marked read-only preview mode. */
 readonly previewMode=signal(false);
 private isUnavailable(error:any):boolean{
  return error?.name==='TimeoutError'||[0,502,503,504,404].includes(error?.status);
 }
 getProducts(query=''){
  return this.http.get<{products:Product[];total:number}>(this.base+'/products'+query).pipe(
   timeout(12000),
   tap(()=>this.previewMode.set(false)),
   catchError(err=>{
    if(!this.isUnavailable(err))return throwError(()=>err);
    this.previewMode.set(true);
    const products=searchPreview(query);
    return of({products,total:products.length});
   })
  );
 }
 getProduct(id:string){
  return this.http.get<{product:Product;similar:Product[]}>(this.base+'/products/'+encodeURIComponent(id)).pipe(
   timeout(12000),
   tap(()=>this.previewMode.set(false)),
   catchError(err=>{
    if(!this.isUnavailable(err))return throwError(()=>err);
    const product=previewProducts.find(p=>p.id===id);
    if(!product)return throwError(()=>err);
    this.previewMode.set(true);
    return of({product,similar:previewProducts.filter(p=>p.id!==id&&p.category===product.category).slice(0,4)});
   })
  );
 }

 getProfile(){return this.http.get<{profile:CustomerProfile}>(this.base+'/profile');}
 saveProfile(payload:ProfileUpdate){return this.http.patch<{profile:CustomerProfile}>(this.base+'/profile',payload);}
 getAddresses(){return this.http.get<{addresses:SavedAddress[]}>(this.base+'/profile/addresses');}
 createAddress(payload:AddressInput){return this.http.post<{addresses:SavedAddress[]}>(this.base+'/profile/addresses',payload);}
 updateAddress(id:string,payload:AddressInput){return this.http.put<{addresses:SavedAddress[]}>(this.base+'/profile/addresses/'+encodeURIComponent(id),payload);}
 selectDefaultAddress(id:string){return this.http.patch<{addresses:SavedAddress[]}>(this.base+'/profile/addresses/'+encodeURIComponent(id)+'/default',{});}
 deleteAddress(id:string){return this.http.delete<{addresses:SavedAddress[]}>(this.base+'/profile/addresses/'+encodeURIComponent(id));}
 loadAvatar(){return this.http.get(this.base+'/profile/avatar',{responseType:'blob'});}
 uploadAvatar(photo:Blob){return this.http.put<{avatarUpdatedAt:string}>(this.base+'/profile/avatar',photo,{headers:{'Content-Type':photo.type}});}
 removeAvatar(){return this.http.delete(this.base+'/profile/avatar');}
 meta(){return this.http.get<{categories:string[];demoMode:boolean;aiEnabled:boolean;checkoutEnabled:boolean}>(this.base+'/meta');}
 login(body:{email:string;password:string}){return this.http.post<{user:User;token:string}>(this.base+'/auth/login',body);}
 register(body:{name:string;email:string;password:string}){return this.http.post<{user:User;token:string}>(this.base+'/auth/register',body);}
 checkout(payload:unknown){return this.http.post<{order:Order;payment:null|{url:string;fields:Record<string,string>};warning?:string}>(this.base+'/orders/checkout',payload);}
 orders(){return this.http.get<{orders:Order[]}>(this.base+'/orders');}
 adminSummary(){return this.http.get<{products:number;lowStock:number;orders:number;demoOrders:number;revenue:number;simulatedRevenue:number;recentOrders:Order[]}>(this.base+'/admin/summary');}
 adminOrders(){return this.http.get<{orders:Order[]}>(this.base+'/admin/orders');}
 setOrderStatus(id:string,status:string){return this.http.patch(this.base+'/admin/orders/'+encodeURIComponent(id),{status});}
 createProduct(product:Partial<Product>){return this.http.post<{product:Product}>(this.base+'/admin/products',product);}
 updateProduct(id:string,changes:Partial<Product>){return this.http.patch<{product:Product}>(this.base+'/admin/products/'+encodeURIComponent(id),changes);}
 chat(message:string){return this.http.post<{reply:string;products:Product[];cartActions:{productId:string;quantity:number}[];mode:string}>(this.base+'/ai/chat',{message});}
 draftListing(body:{name:string;notes:string;category:string}){return this.http.post<{draft:{title:string;description:string;tags:string[]}}>(this.base+'/admin/ai/listing',body);}
}
