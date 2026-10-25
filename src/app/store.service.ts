import {Injectable,computed,signal,inject} from '@angular/core';
import {HttpClient,HttpInterceptorFn} from '@angular/common/http';
export type Product={id:string;name:string;description:string;category:string;price:number;stock:number;image:string;tags:string[];featured:boolean;active:boolean};
export type CartLine={product:Product;quantity:number};
export type User={id:string;name:string;email:string;role:'customer'|'admin'};
export type Order={id:string;items:{productId:string;name:string;price:number;quantity:number;image:string}[];total:number;subtotal:number;shipping:number;status:string;createdAt:string;delivery:{name:string;address:string;city:string}};
export const authInterceptor:HttpInterceptorFn=(req,next)=>{
 const token=typeof localStorage==='undefined'?'':localStorage.getItem('kasi_token');
 return next(token?req.clone({setHeaders:{Authorization:'Bearer '+token}}):req);
};
@Injectable({providedIn:'root'})
export class StoreService{
 readonly cart=signal<CartLine[]>(this.restore<CartLine[]>('kasi_cart',[]));
 readonly user=signal<User|null>(this.restore<User|null>('kasi_user',null));
 readonly count=computed(()=>this.cart().reduce((n,x)=>n+x.quantity,0));
 readonly subtotal=computed(()=>this.cart().reduce((n,x)=>n+x.product.price*x.quantity,0));
 readonly shipping=computed(()=>this.subtotal()>=750||this.subtotal()===0?0:79);
 readonly total=computed(()=>this.subtotal()+this.shipping());
 toast=signal('');
 private restore<T>(key:string,initial:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??initial}catch{return initial}}
 add(product:Product,quantity=1){
  if(product.stock<1){this.notify('This item is out of stock');return;}
  this.cart.update(lines=>{const found=lines.find(l=>l.product.id===product.id);
   if(found)return lines.map(l=>l.product.id===product.id?{...l,quantity:Math.min(l.quantity+quantity,product.stock,20)}:l);
   return [...lines,{product,quantity:Math.min(quantity,product.stock,20)}];});
  this.persist();this.notify(product.name+' added to your bag');
 }
 update(id:string,quantity:number){this.cart.update(lines=>lines.map(l=>l.product.id===id?{...l,quantity:Math.max(1,Math.min(quantity,l.product.stock,20))}:l));this.persist();}
 remove(id:string){this.cart.update(lines=>lines.filter(l=>l.product.id!==id));this.persist();}
 clear(){this.cart.set([]);this.persist();}
 login(token:string,user:User){localStorage.setItem('kasi_token',token);localStorage.setItem('kasi_user',JSON.stringify(user));this.user.set(user);}
 logout(){localStorage.removeItem('kasi_token');localStorage.removeItem('kasi_user');this.user.set(null);}
 notify(message:string){this.toast.set(message);setTimeout(()=>{if(this.toast()===message)this.toast.set('')},3000);}
 private persist(){localStorage.setItem('kasi_cart',JSON.stringify(this.cart()));}
}
@Injectable({providedIn:'root'})
export class ApiService{
 private http=inject(HttpClient);
 private readonly base='/api';
 getProducts(query=''){return this.http.get<{products:Product[];total:number}>(this.base+'/products'+query);}
 getProduct(id:string){return this.http.get<{product:Product;similar:Product[]}>(this.base+'/products/'+encodeURIComponent(id));}
 meta(){return this.http.get<{categories:string[];demoMode:boolean;aiEnabled:boolean;checkoutEnabled:boolean}>(this.base+'/meta');}
 login(body:{email:string;password:string}){return this.http.post<{user:User;token:string}>(this.base+'/auth/login',body);}
 register(body:{name:string;email:string;password:string}){return this.http.post<{user:User;token:string}>(this.base+'/auth/register',body);}
 checkout(payload:unknown){return this.http.post<{order:Order;payment:null|{url:string;fields:Record<string,string>};warning?:string}>(this.base+'/orders/checkout',payload);}
 orders(){return this.http.get<{orders:Order[]}>(this.base+'/orders');}
 adminSummary(){return this.http.get<{products:number;lowStock:number;orders:number;revenue:number;recentOrders:Order[]}>(this.base+'/admin/summary');}
 adminOrders(){return this.http.get<{orders:Order[]}>(this.base+'/admin/orders');}
 setOrderStatus(id:string,status:string){return this.http.patch(this.base+'/admin/orders/'+encodeURIComponent(id),{status});}
 createProduct(product:Partial<Product>){return this.http.post<{product:Product}>(this.base+'/admin/products',product);}
 updateProduct(id:string,changes:Partial<Product>){return this.http.patch<{product:Product}>(this.base+'/admin/products/'+encodeURIComponent(id),changes);}
 chat(message:string){return this.http.post<{reply:string;products:Product[];cartActions:{productId:string;quantity:number}[];mode:string}>(this.base+'/ai/chat',{message});}
 draftListing(body:{name:string;notes:string;category:string}){return this.http.post<{draft:{title:string;description:string;tags:string[]}}>(this.base+'/admin/ai/listing',body);}
}
