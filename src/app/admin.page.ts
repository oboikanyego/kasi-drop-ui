import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ApiService, StoreService, Product, Order } from './store.service';
import { prepareImage } from './image-upload';

/** A new product starts empty; its photo is uploaded rather than linked. */
const blankForm = () => ({
  name: '',
  description: '',
  category: 'Crafts',
  price: 199,
  stock: 10,
  image: '', // path of the uploaded photo, e.g. /api/images/<id>
  tags: 'local, handmade',
  featured: false,
  active: true,
});
/** The API accepts photos up to 1 MB, so larger ones are shrunk first. */
const productPhoto = { maxSide: 1200, maxBytes: 1024 * 1024 };
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonicModule],
  templateUrl: './admin.page.html',
})
export class AdminPage implements OnInit, OnDestroy {
  api = inject(ApiService);
  private http = inject(HttpClient);
  analytics?: {
    periodDays: number;
    counts: Record<string, number>;
    checkoutConversion: number;
    note: string;
  };
  feedback: Array<{ category: string; rating?: number; message: string; createdAt: string }> = [];
  store = inject(StoreService);
  tab: 'overview' | 'products' | 'orders' | 'add' | 'insights' = 'overview';
  summary?: {
    products: number;
    lowStock: number;
    orders: number;
    demoOrders: number;
    revenue: number;
    simulatedRevenue: number;
    recentOrders: Order[];
  };
  products: Product[] = [];
  orders: Order[] = [];
  busy = false;
  error = '';
  notice = '';
  form = blankForm();
  /** Browser-local preview of the chosen photo (an object URL, released when replaced). */
  imagePreview: string | null = null;
  uploadingImage = false;
  imageError = '';
  notes = '';
  generating = false;
  ngOnInit() {
    if (this.store.user()?.role === 'admin') this.refresh();
  }
  refresh() {
    this.http
      .get<{
        periodDays: number;
        counts: Record<string, number>;
        checkoutConversion: number;
        note: string;
      }>('/api/admin/analytics')
      .subscribe({
        next: (r) => (this.analytics = r),
        error: () => (this.error = 'Could not load analytics.'),
      });
    this.http
      .get<{
        feedback: Array<{ category: string; rating?: number; message: string; createdAt: string }>;
      }>('/api/admin/feedback')
      .subscribe({
        next: (r) => (this.feedback = r.feedback),
        error: () => (this.error = 'Could not load customer feedback.'),
      });
    this.api.adminSummary().subscribe({
      next: (r) => (this.summary = r),
      error: () => (this.error = 'Could not load admin summary.'),
    });
    this.api.getProducts().subscribe({ next: (r) => (this.products = r.products) });
    this.api.adminOrders().subscribe({ next: (r) => (this.orders = r.orders) });
  }
  stockChange(p: Product, n: number) {
    if (!Number.isInteger(n) || n < 0) return;
    this.api.updateProduct(p.id, { stock: n }).subscribe({
      next: (r) => {
        p.stock = r.product.stock;
        this.notice = 'Stock updated';
        this.refresh();
      },
      error: () => (this.error = 'Could not save stock.'),
    });
  }
  setStatus(order: Order, status: string) {
    this.api.setOrderStatus(order.id, status).subscribe({
      next: () => {
        order.status = status;
        this.notice = 'Order updated';
        this.refresh();
      },
      error: (e) => (this.error = e.error?.error || 'Could not update order'),
    });
  }
  add() {
    this.busy = true;
    this.error = '';
    this.api
      .createProduct({
        ...this.form,
        tags: this.form.tags
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.notice = 'Product published';
          // Start the next product from scratch rather than reusing this one's photo and text.
          this.form = blankForm();
          this.notes = '';
          this.setImage('', null);
          this.tab = 'products';
          this.refresh();
        },
        error: (e) => {
          this.busy = false;
          this.error = e.error?.error || 'Could not save product';
        },
      });
  }
  async chooseImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploadingImage) return;
    this.uploadingImage = true;
    this.imageError = '';
    let photo: Blob;
    try {
      photo = await prepareImage(file, productPhoto);
    } catch (e) {
      this.imageError = e instanceof Error ? e.message : 'Could not process this image.';
      this.uploadingImage = false;
      return;
    }
    this.api.uploadProductImage(photo).subscribe({
      next: ({ url }) => {
        this.setImage(url, photo);
        this.uploadingImage = false;
      },
      error: (e) => {
        // The previous photo, if any, stays selected.
        this.imageError = e.error?.error || 'Photo upload failed. Please try again.';
        this.uploadingImage = false;
      },
    });
  }
  removeImage() {
    this.setImage('', null);
    this.imageError = '';
  }
  private setImage(url: string, photo: Blob | null) {
    if (this.imagePreview) URL.revokeObjectURL(this.imagePreview);
    this.imagePreview = photo ? URL.createObjectURL(photo) : null;
    this.form.image = url;
  }
  ngOnDestroy() {
    if (this.imagePreview) URL.revokeObjectURL(this.imagePreview);
  }
  generate() {
    this.generating = true;
    this.error = '';
    this.api
      .draftListing({
        name: this.form.name || 'New local product',
        notes: this.notes,
        category: this.form.category,
      })
      .subscribe({
        next: (r) => {
          this.form.name = r.draft.title;
          this.form.description = r.draft.description;
          this.form.tags = r.draft.tags.join(', ');
          this.notice = 'AI draft created — review before saving';
          this.generating = false;
        },
        error: (e) => {
          this.error =
            e.error?.error || 'AI drafting unavailable. Configure Gemini or Groq on the backend.';
          this.generating = false;
        },
      });
  }
}
