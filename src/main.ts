import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AppComponent } from './app/app.component';
import { registerKasiDropIcons } from './app/icons';
import { routes } from './app/app.routes';
import { apiInterceptor } from './app/store.service';
import { migrateLegacySession } from './app/legacy-session';
// Register SVGs before Angular bootstraps any Ionic icon component.
registerKasiDropIcons();
// Move any token an older UI left in localStorage into the session cookie before any request.
migrateLegacySession()
  .catch(() => undefined)
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
