import { Routes } from '@angular/router';
import { HomePage, ShopPage, ProductPage, FavoritesPage } from './shop.pages';
import { CartPage, CheckoutPage, OrdersPage } from './customer.pages';
import { AccountPage } from './profile.page';
import { AdminPage } from './admin.page';
export const routes: Routes = [
  { path: '', component: HomePage, title: 'KasiDrop | Local roots. Delivered.' },
  { path: 'shop', component: ShopPage, title: 'Catalog | KasiDrop' },
  { path: 'product/:id', component: ProductPage, title: 'Product | KasiDrop' },
  { path: 'cart', component: CartPage, title: 'Your Cart | KasiDrop' },
  { path: 'favorites', component: FavoritesPage, title: 'Saved Favorites | KasiDrop' },
  { path: 'checkout', component: CheckoutPage, title: 'Checkout | KasiDrop' },
  { path: 'orders', component: OrdersPage, title: 'Your Orders | KasiDrop' },
  { path: 'account', component: AccountPage, title: 'Your Account | KasiDrop' },
  { path: 'admin', component: AdminPage, title: 'Admin | KasiDrop' },
  { path: '**', redirectTo: '' },
];
