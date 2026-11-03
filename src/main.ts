import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AppComponent } from './app/app.component';
import { registerKasiDropIcons } from './app/icons';
import { routes } from './app/app.routes';
import { apiInterceptor } from './app/store.service';
import { migrateLegacySession } from './app/legacy-session';
import { wakeApi } from './app/wake-api';
// Register SVGs before Angular bootstraps any Ionic icon component.
registerKasiDropIcons();
// Wake a sleeping API first (the splash in index.html is showing), then move any token an older UI
// left in localStorage into the session cookie, so no request goes out before the API can answer.
wakeApi({
  onSlow: () => document.getElementById('boot-wake-message')?.removeAttribute('hidden'),
})
  .catch(() => 'gave-up' as const)
  // If the API never woke, skip the cookie swap (it would only hang) and boot into offline preview.
  .then((outcome) =>
    outcome === 'gave-up' ? undefined : migrateLegacySession().catch(() => undefined),
  )
  .then(() =>
    bootstrapApplication(AppComponent, {
      providers: [
        provideIonicAngular(),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
      ],
    }),
  )
  .catch(console.error);
