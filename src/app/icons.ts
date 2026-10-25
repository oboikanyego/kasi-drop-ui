import { addIcons, setAssetPath } from 'ionicons';
import {
  addOutline,
  arrowForwardOutline,
  bagHandleOutline,
  cafeOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  colorPaletteOutline,
  cubeOutline,
  ellipsisHorizontalOutline,
  giftOutline,
  gridOutline,
  heart,
  heartOutline,
  homeOutline,
  informationCircleOutline,
  locationOutline,
  notificationsOutline,
  personCircleOutline,
  removeOutline,
  searchOutline,
  sendOutline,
  shareOutline,
  shirtOutline,
  sparklesOutline,
  trashOutline,
} from 'ionicons/icons';

/** Explicit, tree-shakable SVG icon catalogue for all Ionic templates.
 * Use the kebab-case names to avoid silent asset-path lookup failures.
 */
export const kasiDropIcons = {
  'add-outline': addOutline,
  'arrow-forward-outline': arrowForwardOutline,
  'bag-handle-outline': bagHandleOutline,
  'cafe-outline': cafeOutline,
  'checkmark-circle-outline': checkmarkCircleOutline,
  'checkmark-outline': checkmarkOutline,
  'chevron-back-outline': chevronBackOutline,
  'chevron-forward-outline': chevronForwardOutline,
  'close-outline': closeOutline,
  'color-palette-outline': colorPaletteOutline,
  'cube-outline': cubeOutline,
  'ellipsis-horizontal-outline': ellipsisHorizontalOutline,
  'gift-outline': giftOutline,
  'grid-outline': gridOutline,
  heart: heart,
  'heart-outline': heartOutline,
  'home-outline': homeOutline,
  'information-circle-outline': informationCircleOutline,
  'location-outline': locationOutline,
  'notifications-outline': notificationsOutline,
  'person-circle-outline': personCircleOutline,
  'remove-outline': removeOutline,
  'search-outline': searchOutline,
  'send-outline': sendOutline,
  'share-outline': shareOutline,
  'shirt-outline': shirtOutline,
  'sparkles-outline': sparklesOutline,
  'trash-outline': trashOutline,
} as const;

export function registerKasiDropIcons(): void {
  // Set a local path for any icon used outside the explicit registry, too.
  // Angular copies Ionicons SVGs to /svg/ as part of the production build.
  setAssetPath(new URL('svg/', document.baseURI).href);
  addIcons(kasiDropIcons);
}
