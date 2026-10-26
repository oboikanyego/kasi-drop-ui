import { Component, inject, signal } from '@angular/core';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { InsightsService, type AnalyticsPage } from './insights.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonApp, IonContent, IonIcon } from '@ionic/angular/standalone';
import { ApiService, StoreService, type Product } from './store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IonApp,
    IonContent,
    IonIcon,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./preview-status.scss'],
})
export class AppComponent {
  readonly store = inject(StoreService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  readonly insights = inject(InsightsService);
  search = '';
  brandLogoFailed = false;
  chatOpen = signal(false);
  chatText = '';
  thinking = signal(false);
  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(event => {
      const segment = event.urlAfterRedirects.split('?')[0].split('/')[1] || 'home';
      const page: AnalyticsPage = ['home','shop','product','cart','checkout','orders','favorites','account','admin','feedback'].includes(segment) ? segment as AnalyticsPage : 'other';
      this.insights.track('page_view', page);
    });
    // Older API deployments omit the rule; the store then keeps its default.
    this.api.meta().subscribe({ next: (meta) => this.store.useShippingRule(meta.shipping) });
  }
  chatMessages = signal<{ from: 'bot' | 'user'; text: string; products?: Product[] }[]>([
    {
      from: 'bot',
      text: 'Sawubona! Tell me what you are shopping for and I will search KasiDrop for real local finds.',
    },
  ]);
  addSuggestedProduct(product: Product) {
    if (product.active && product.stock > 0) this.store.add(product, 1);
  }
  onSuggestedImageError(event: Event) {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/assets/brand/kasidrop-icon-transparent.webp';
  }
  searchNow() {
    if (this.search.trim()) this.insights.track('product_search', 'shop');
    this.router.navigate(['/shop'], {
      queryParams: this.search.trim() ? { q: this.search.trim() } : {},
    });
  }
  sendChat() {
    const message = this.chatText.trim();
    if (!message || this.thinking()) return;
    this.chatMessages.update((items) => [...items, { from: 'user', text: message }]);
    this.chatText = '';
    this.thinking.set(true);
    this.insights.track('ai_chat');
    this.api.chat(message).subscribe({
      next: (result) => {
        this.chatMessages.update((items) => [
          ...items,
          { from: 'bot', text: result.reply, products: result.products || [] },
        ]);
        for (const action of result.cartActions) {
          const product = result.products.find((p) => p.id === action.productId);
          if (product) this.store.add(product, action.quantity);
        }
        this.thinking.set(false);
      },
      error: (error) => {
        this.chatMessages.update((items) => [
          ...items,
          {
            from: 'bot',
            text:
              error?.name === 'TimeoutError'
                ? 'Kasi AI is taking too long to answer. Please try again in a moment — the catalogue is still open for browsing.'
                : 'I cannot connect right now. The catalogue is still open for browsing.',
          },
        ]);
        this.thinking.set(false);
      },
    });
  }
}
