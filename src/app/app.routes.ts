import {Routes} from '@angular/router';
import {HomePage,ShopPage,ProductPage} from './shop.pages';
import {CartPage,CheckoutPage,OrdersPage,AccountPage} from './customer.pages';
import {AdminPage} from './admin.page';
export const routes:Routes=[
 {path:'',component:HomePage,title:'KasiDrop | Local roots. Delivered.'},
 {path:'shop',component:ShopPage,title:'Shop Local | KasiDrop'},
 {path:'product/:id',component:ProductPage,title:'Product | KasiDrop'},
 {path:'cart',component:CartPage,title:'Your Bag | KasiDrop'},
 {path:'checkout',component:CheckoutPage,title:'Checkout | KasiDrop'},
 {path:'orders',component:OrdersPage,title:'Your Orders | KasiDrop'},
 {path:'account',component:AccountPage,title:'Your Account | KasiDrop'},
 {path:'admin',component:AdminPage,title:'Admin | KasiDrop'},
 {path:'**',redirectTo:''}
];
