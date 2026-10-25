import {bootstrapApplication} from '@angular/platform-browser';
import {provideHttpClient,withInterceptors} from '@angular/common/http';
import {provideRouter,withInMemoryScrolling} from '@angular/router';
import {provideIonicAngular} from '@ionic/angular/standalone';
import {AppComponent} from './app/app.component';
import { registerKasiDropIcons } from './app/icons';
import {routes} from './app/app.routes';
import {authInterceptor} from './app/store.service';
// Register SVGs before Angular bootstraps any Ionic icon component.
registerKasiDropIcons();
bootstrapApplication(AppComponent,{providers:[provideIonicAngular(),provideHttpClient(withInterceptors([authInterceptor])),provideRouter(routes,withInMemoryScrolling({scrollPositionRestoration:'top'}))]}).catch(console.error);
