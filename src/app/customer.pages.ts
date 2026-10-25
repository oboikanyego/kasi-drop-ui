import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, timer, switchMap, take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { IonIcon } from '@ionic/angular/standalone';
import { ApiService, StoreService, type SavedAddress, type Order } from './store.service';
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonIcon],
  templateUrl: './cart.page.html',
})
export class CartPage {
  store = inject(StoreService);
  api = inject(ApiService);
}
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonicModule],
  templateUrl: './checkout.page.html',
  styleUrls: ['./profile-page.scss'],
})
export class CheckoutPage implements OnInit {
  api = inject(ApiService);
  store = inject(StoreService);
  router = inject(Router);
  delivery = { name: '', phone: '', address: '', city: '', province: 'Gauteng', postalCode: '' };
  savedAddresses: SavedAddress[] = [];
  selectedAddressId = 'manual';
  profileName = '';
  profilePhone = '';
  addressLoading = false;
  method: 'demo' | 'payfast' = 'demo';
  demo = true;
  busy = false;
  error = '';
  ngOnInit() {
    this.api.meta().subscribe({
      next: (m) => {
        this.demo = m.demoMode;
        this.method = m.demoMode ? 'demo' : 'payfast';
      },
      error: () => (this.error = 'Checkout service is unavailable.'),
    });
    if (this.store.user()) {
      this.addressLoading = true;
      this.api.getProfile().subscribe({
        next: ({ profile }) => {
          this.savedAddresses = profile.addresses;
          this.profileName = profile.name;
          this.profilePhone = profile.phone;
          const preferred = profile.addresses.find((a) => a.isDefault);
          this.selectedAddressId = preferred?.id || 'manual';
          this.onAddressSelected();
          this.addressLoading = false;
        },
        error: () => {
          this.addressLoading = false;
          this.delivery.name = this.store.user()?.name || '';
        },
      });
    }
  }
  onAddressSelected() {
    const found = this.savedAddresses.find((address) => address.id === this.selectedAddressId);
    if (!found) {
      this.delivery = {
        name: this.profileName || this.store.user()?.name || '',
        phone: this.profilePhone,
        address: '',
        city: '',
        province: 'Gauteng',
        postalCode: '',
      };
      return;
    }
    this.delivery = {
      name: found.recipientName,
      phone: found.phone,
      address: found.unit ? found.unit + ', ' + found.street : found.street,
      city: found.city,
      province: found.province,
      postalCode: found.postalCode,
    };
  }
  submit() {
    if (this.api.previewMode()) {
      this.error = 'Checkout is disabled while the catalogue is in offline preview mode.';
      return;
    }
    if (this.busy || !this.store.selectedCart().length || !this.store.user()) return;
    this.busy = true;
    this.error = '';
    const items = this.store
      .selectedCart()
      .map((l) => ({ productId: l.product.id, quantity: l.quantity }));
    this.api.checkout({ items, paymentMethod: this.method, delivery: this.delivery }).subscribe({
      next: (r) => {
        if (r.payment) {
          // Store order reference before leaving for PayFast. A browser redirect is not payment proof.
          this.store.rememberPendingCheckout(r.order.id, items);
          const form = document.createElement('form');
          form.action = r.payment.url;
          form.method = 'POST';
          for (const [name, value] of Object.entries(r.payment.fields)) {
            const field = document.createElement('input');
            field.type = 'hidden';
            field.name = name;
            field.value = value;
            form.appendChild(field);
          }
          document.body.appendChild(form);
          form.submit();
          return;
        }
        this.store.clearSelected();
        this.store.notify(r.warning || 'Your order has been placed!');
        this.router.navigateByUrl('/orders');
        this.busy = false;
      },
      error: (e) => {
        this.error = e.error?.error || 'Could not process checkout. Please retry.';
        this.busy = false;
      },
    });
  }
}
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IonicModule],
  templateUrl: './orders.page.html',
})
export class OrdersPage implements OnInit, OnDestroy {
  store = inject(StoreService);
  api = inject(ApiService);
  route = inject(ActivatedRoute);
  orders: Order[] = [];
  loading = true;
  error = '';
  paymentNotice = '';
  private polling?: Subscription;
  ngOnInit() {
    if (!this.store.user()) {
      this.loading = false;
      return;
    }
    const returnStatus = this.route.snapshot.queryParamMap.get('payment');
    if (returnStatus === 'return')
      this.paymentNotice =
        'Checking your payment with KasiDrop. Your bag is kept until PayFast confirms it.';
    if (returnStatus === 'cancel')
      this.paymentNotice = 'Checkout was cancelled. Your bag has been kept.';
    this.refresh();
    // PayFast's server callback can arrive after the browser redirect.
    // Poll only when returning from payment with an outstanding matching order.
    if (returnStatus === 'return' && this.store.pendingCheckout()) {
      this.polling = timer(3000, 3000)
        .pipe(
          take(20),
          switchMap(() => this.api.orders()),
        )
        .subscribe({
          next: ({ orders }) => this.acceptOrders(orders),
          error: () => {
            this.paymentNotice =
              'We could not confirm the payment yet. Your bag is safe; refresh your orders later.';
          },
        });
    }
  }
  refresh() {
    this.api.orders().subscribe({
      next: ({ orders }) => {
        this.acceptOrders(orders);
        this.loading = false;
        this.error = '';
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load orders. Please retry.';
      },
    });
  }
  private acceptOrders(orders: Order[]) {
    this.orders = orders;
    const pending = this.store.pendingCheckout();
    if (!pending) return;
    const matching = orders.find((order) => order.id === pending.orderId);
    if (!matching) return;
    if (this.store.completeVerifiedCheckout(matching)) {
      this.paymentNotice =
        'Payment confirmed! Your purchased items have been removed from your bag.';
      this.polling?.unsubscribe();
    } else if (['failed', 'cancelled', 'canceled'].includes(matching.status)) {
      this.paymentNotice = 'Payment was not completed. Your items are still in your bag.';
      this.polling?.unsubscribe();
    } else if (['requires_review'].includes(matching.status)) {
      this.paymentNotice = 'This payment requires review. Your items remain in the bag for now.';
      this.polling?.unsubscribe();
    }
  }
  ngOnDestroy() {
    this.polling?.unsubscribe();
  }
}
