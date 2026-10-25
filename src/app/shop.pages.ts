import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { ApiService, Product, StoreService } from './store.service';
import { ProductGridComponent } from './product-grid.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductGridComponent, IonIcon],
  templateUrl: './home.page.html',
})
export class HomePage implements OnInit {
  readonly api = inject(ApiService);
  readonly store = inject(StoreService);
  readonly router = inject(Router);
  searchTerm = '';
  featured: Product[] = [];
  loading = true;
  error = '';
  ngOnInit() {
    this.reload();
  }
  reload() {
    this.loading = true;
    this.error = '';
    this.api.getProducts().subscribe({
      next: (r) => {
        this.featured = r.products.filter((p) => p.featured).slice(0, 8);
        this.loading = false;
      },
      error: () => {
        this.error = 'The shop is temporarily unavailable.';
        this.loading = false;
      },
    });
  }
  searchNow() {
    this.router.navigate(['/shop'], {
      queryParams: this.searchTerm.trim() ? { q: this.searchTerm.trim() } : {},
    });
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, ProductGridComponent, FormsModule, IonIcon],
  templateUrl: './shop.page.html',
})
export class ShopPage implements OnInit {
  readonly api = inject(ApiService);
  readonly route = inject(ActivatedRoute);
  products: Product[] = [];
  categories = ['All', 'Food & Drink', 'Fashion', 'Home & Living', 'Crafts'];
  category = 'All';
  q = '';
  sort = 'featured';
  maxPrice = 0;
  loading = true;
  error = '';
  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      this.category = params.get('category') || 'All';
      this.q = params.get('q') || '';
      this.load();
    });
  }
  load() {
    this.loading = true;
    this.error = '';
    const params = new URLSearchParams();
    if (this.q.trim()) params.set('q', this.q.trim());
    if (this.category !== 'All') params.set('category', this.category);
    if (this.sort !== 'featured') params.set('sort', this.sort);
    if (this.maxPrice > 0) params.set('maxPrice', String(this.maxPrice));
    this.api.getProducts('?' + params.toString()).subscribe({
      next: (r) => {
        this.products = r.products;
        this.loading = false;
      },
      error: () => {
        this.error = 'We could not load the catalogue. Please try again.';
        this.loading = false;
      },
    });
  }
  setCategory(c: string) {
    this.category = c;
    this.load();
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, ProductGridComponent, IonIcon],
  templateUrl: './product.page.html',
})
export class ProductPage implements OnInit {
  readonly api = inject(ApiService);
  readonly store = inject(StoreService);
  readonly route = inject(ActivatedRoute);
  product?: Product;
  similar: Product[] = [];
  quantity = 1;
  error = '';
  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id)
        this.api.getProduct(id).subscribe({
          next: (r) => {
            this.product = r.product;
            this.similar = r.similar;
            this.quantity = 1;
            this.error = '';
          },
          error: () => {
            this.error = 'Product not found.';
            this.product = undefined;
          },
        });
    });
  }
  adjust(delta: number) {
    if (this.product)
      this.quantity = Math.max(1, Math.min(20, this.product.stock, this.quantity + delta));
  }
  imageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'https://placehold.co/900x900/f2f3f4/323432?text=KasiDrop';
  }
  async share() {
    if (!this.product) return;
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: this.product.name,
          text: 'See this local find on KasiDrop',
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        this.store.notify('Product link copied');
      } else this.store.notify('Copy the page address to share this product');
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError')
        this.store.notify('Could not share this product');
    }
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, ProductGridComponent, IonIcon],
  templateUrl: './favorites.page.html',
})
export class FavoritesPage implements OnInit {
  readonly api = inject(ApiService);
  readonly store = inject(StoreService);
  allProducts: Product[] = [];
  get favoriteProducts() {
    return this.allProducts.filter((p) => this.store.isFavorite(p.id));
  }
  loading = true;
  error = '';
  ngOnInit() {
    this.api.getProducts().subscribe({
      next: (r) => {
        this.allProducts = r.products;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load saved products.';
        this.loading = false;
      },
    });
  }
}
