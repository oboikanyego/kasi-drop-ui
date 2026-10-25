import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  StoreService,
  type AddressInput,
  type AddressLabel,
  type CustomerProfile,
  type ProfileUpdate,
  type SavedAddress,
} from './store.service';

const blankAddress = (): AddressInput => ({
  label: 'Home',
  nickname: '',
  recipientName: '',
  phone: '',
  street: '',
  unit: '',
  suburb: '',
  city: '',
  province: 'Gauteng',
  postalCode: '',
  deliveryNotes: '',
  isDefault: false,
});

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './account.page.html',
  styleUrls: ['./profile-page.scss'],
})
export class AccountPage implements OnInit, OnDestroy {
  readonly store = inject(StoreService);
  readonly api = inject(ApiService);
  readonly provinces = [
    'Gauteng',
    'Western Cape',
    'KwaZulu-Natal',
    'Eastern Cape',
    'Free State',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
  ];
  readonly languages = [
    'English',
    'isiZulu',
    'isiXhosa',
    'Sesotho',
    'Setswana',
    'Afrikaans',
    'Sepedi',
    'Other',
  ];
  readonly addressLabels: AddressLabel[] = ['Home', 'Work', 'Other'];

  registerMode = false;
  busy = false;
  error = '';
  name = '';
  email = '';
  password = '';
  demoLoginAvailable = false;

  profile: CustomerProfile | null = null;
  loadingProfile = false;
  profileError = '';
  savingProfile = false;
  editProfile = false;
  profileForm: ProfileUpdate = {
    name: '',
    phone: '',
    about: '',
    preferredLanguage: 'English',
    marketingOptIn: false,
  };

  avatarSrc: string | null = null;
  savingAvatar = false;
  avatarError = '';

  addressForm: AddressInput = blankAddress();
  editingAddressId: string | null = null;
  showAddressForm = false;
  savingAddress = false;
  addressError = '';

  ngOnInit() {
    this.api
      .meta()
      .subscribe({
        next: (meta) => (this.demoLoginAvailable = meta.demoMode),
        error: () => (this.demoLoginAvailable = false),
      });
    if (this.store.user()) this.loadProfile();
  }
  ngOnDestroy() {
    this.clearAvatarUrl();
  }
  submit() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    const request = this.registerMode
      ? this.api.register({ name: this.name, email: this.email, password: this.password })
      : this.api.login({ email: this.email, password: this.password });
    request.subscribe({
      next: (result) => {
        this.store.login(result.token, result.user);
        this.password = '';
        this.busy = false;
        this.loadProfile();
      },
      error: (e) => {
        this.error = e.error?.error || 'Could not sign in. Please check your details.';
        this.busy = false;
      },
    });
  }
  logout() {
    this.store.logout();
    this.profile = null;
    this.clearAvatarUrl();
    this.editProfile = false;
    this.showAddressForm = false;
    this.addressError = '';
    this.avatarError = '';
    this.store.notify('Signed out');
  }
  fillDemo(role: 'admin' | 'shopper') {
    if (!this.demoLoginAvailable) return;
    this.email = role === 'admin' ? 'admin@kasidrop.test' : 'shopper@kasidrop.test';
    this.password = 'Demo@12345';
    this.registerMode = false;
  }
  loadProfile() {
    this.loadingProfile = true;
    this.profileError = '';
    this.api.getProfile().subscribe({
      next: ({ profile }) => {
        this.profile = profile;
        this.loadingProfile = false;
        this.profileForm = {
          name: profile.name,
          phone: profile.phone,
          about: profile.about,
          preferredLanguage: profile.preferredLanguage,
          marketingOptIn: profile.marketingOptIn,
        };
        this.loadAvatar(profile.avatarUpdatedAt);
      },
      error: (err) => {
        this.loadingProfile = false;
        if (err.status === 401) {
          this.store.logout();
          this.profile = null;
          this.clearAvatarUrl();
        } else this.profileError = 'Could not load your profile. Please try again.';
      },
    });
  }
  saveProfile() {
    if (this.savingProfile || !this.profile) return;
    this.savingProfile = true;
    this.profileError = '';
    this.api.saveProfile(this.profileForm).subscribe({
      next: ({ profile }) => {
        this.profile = profile;
        this.store.updateAccountName(profile.name);
        this.editProfile = false;
        this.savingProfile = false;
        this.store.notify('Profile updated');
      },
      error: (e) => {
        this.savingProfile = false;
        this.profileError = e.error?.error || 'Could not save your profile.';
      },
    });
  }
  cancelProfileEdit() {
    if (!this.profile) return;
    this.editProfile = false;
    this.profileForm = {
      name: this.profile.name,
      phone: this.profile.phone,
      about: this.profile.about,
      preferredLanguage: this.profile.preferredLanguage,
      marketingOptIn: this.profile.marketingOptIn,
    };
  }

  get addresses() {
    return this.profile?.addresses || [];
  }
  get defaultAddress() {
    return this.addresses.find((a) => a.isDefault);
  }
  startAddress(address?: SavedAddress) {
    this.addressError = '';
    this.editingAddressId = address?.id || null;
    this.addressForm = address
      ? {
          label: address.label,
          nickname: address.nickname,
          recipientName: address.recipientName,
          phone: address.phone,
          street: address.street,
          unit: address.unit,
          suburb: address.suburb,
          city: address.city,
          province: address.province,
          postalCode: address.postalCode,
          deliveryNotes: address.deliveryNotes,
          isDefault: address.isDefault,
        }
      : blankAddress();
    if (!address && this.profile) {
      this.addressForm.recipientName = this.profile.name;
      this.addressForm.phone = this.profile.phone;
      this.addressForm.isDefault = this.addresses.length === 0;
    }
    this.showAddressForm = true;
  }
  cancelAddress() {
    this.showAddressForm = false;
    this.editingAddressId = null;
    this.addressError = '';
  }
  saveAddress() {
    if (this.savingAddress || !this.profile) return;
    this.savingAddress = true;
    this.addressError = '';
    const request = this.editingAddressId
      ? this.api.updateAddress(this.editingAddressId, this.addressForm)
      : this.api.createAddress(this.addressForm);
    request.subscribe({
      next: ({ addresses }) => {
        this.profile = { ...this.profile!, addresses };
        this.savingAddress = false;
        this.cancelAddress();
        this.store.notify('Address saved');
      },
      error: (e) => {
        this.savingAddress = false;
        this.addressError = e.error?.error || 'Could not save this address.';
      },
    });
  }
  setDefault(address: SavedAddress) {
    if (!this.profile || address.isDefault || this.savingAddress) return;
    this.savingAddress = true;
    this.addressError = '';
    this.api.selectDefaultAddress(address.id).subscribe({
      next: ({ addresses }) => {
        this.profile = { ...this.profile!, addresses };
        this.savingAddress = false;
        this.store.notify('Default address updated');
      },
      error: (e) => {
        this.savingAddress = false;
        this.addressError = e.error?.error || 'Could not change default address.';
      },
    });
  }
  deleteAddress(address: SavedAddress) {
    if (!this.profile || this.savingAddress) return;
    if (!window.confirm('Remove your ' + address.label.toLowerCase() + ' address?')) return;
    this.savingAddress = true;
    this.addressError = '';
    this.api.deleteAddress(address.id).subscribe({
      next: ({ addresses }) => {
        this.profile = { ...this.profile!, addresses };
        this.savingAddress = false;
        this.store.notify('Address removed');
      },
      error: (e) => {
        this.savingAddress = false;
        this.addressError = e.error?.error || 'Could not remove address.';
      },
    });
  }
  private clearAvatarUrl() {
    if (this.avatarSrc) URL.revokeObjectURL(this.avatarSrc);
    this.avatarSrc = null;
  }
  private loadAvatar(stamp: string | null) {
    this.clearAvatarUrl();
    if (!stamp) return;
    this.api.loadAvatar().subscribe({
      next: (blob) => {
        this.clearAvatarUrl();
        this.avatarSrc = URL.createObjectURL(blob);
      },
      error: () => this.clearAvatarUrl(),
    });
  }
  private async resizeAvatar(file: File): Promise<Blob> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      throw Error('Choose a JPG, PNG or WebP image.');
    if (file.size > 5 * 1024 * 1024) throw Error('Choose an image smaller than 5 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      const maxSide = 600,
        scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Image processing is unavailable in this browser.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.7, 0.52]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality),
        );
        if (blob && blob.size <= 512 * 1024) return blob;
      }
      throw Error('Unable to compress the image. Please choose a smaller photo.');
    } finally {
      bitmap.close();
    }
  }
  async chooseAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.savingAvatar) return;
    this.savingAvatar = true;
    this.avatarError = '';
    try {
      const optimized = await this.resizeAvatar(file);
      this.api.uploadAvatar(optimized).subscribe({
        next: ({ avatarUpdatedAt }) => {
          if (this.profile) this.profile = { ...this.profile, avatarUpdatedAt };
          this.loadAvatar(avatarUpdatedAt);
          this.savingAvatar = false;
          this.store.notify('Profile photo updated');
        },
        error: (e) => {
          this.savingAvatar = false;
          this.avatarError = e.error?.error || 'Photo upload failed.';
        },
      });
    } catch (e) {
      this.avatarError = e instanceof Error ? e.message : 'Could not process this image.';
      this.savingAvatar = false;
    }
  }
  removeAvatar() {
    if (!this.profile?.avatarUpdatedAt || this.savingAvatar) return;
    this.savingAvatar = true;
    this.avatarError = '';
    this.api.removeAvatar().subscribe({
      next: () => {
        if (this.profile) this.profile = { ...this.profile, avatarUpdatedAt: null };
        this.clearAvatarUrl();
        this.savingAvatar = false;
        this.store.notify('Photo removed');
      },
      error: () => {
        this.avatarError = 'Could not remove the profile photo.';
        this.savingAvatar = false;
      },
    });
  }
}
