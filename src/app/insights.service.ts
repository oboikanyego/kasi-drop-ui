import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type AnalyticsEvent =
  | 'page_view'
  | 'product_search'
  | 'ai_chat'
  | 'add_to_cart'
  | 'checkout_started'
  | 'checkout_created'
  | 'api_error';
export type AnalyticsPage =
  | 'home'
  | 'shop'
  | 'product'
  | 'cart'
  | 'checkout'
  | 'orders'
  | 'favorites'
  | 'account'
  | 'admin'
  | 'feedback'
  | 'other';

@Injectable({ providedIn: 'root' })
export class InsightsService {
  private readonly http = inject(HttpClient);
  track(name: AnalyticsEvent, page?: AnalyticsPage): void {
    // Analytics must never block shopping or expose queries, prompts or customer data.
    this.http.post('/api/analytics/events', { name, page }).subscribe({ error: () => {} });
  }
  sendFeedback(data: {
    category: 'bug' | 'idea' | 'experience' | 'other';
    rating?: number;
    message: string;
  }) {
    return this.http.post<{ received: boolean }>('/api/feedback', data);
  }
}
