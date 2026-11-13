import {places} from './data.js';
// Replace this synchronous local repository with an authenticated async API adapter
// when real collaboration is enabled. No remote account or API key is used here.
export const repository={
 key:'roam-taiwan-v1',
 read(){const raw=localStorage.getItem(this.key);if(!raw)return null;const state=JSON.parse(raw);for(const trip of state.trips||[]){if(trip.cities?.includes('台南')&&trip.cover?.includes('photo-1470004914212-05527e49370b'))trip.cover='./assets/tainan-shennong.jpg';}return state;},
 write(state){localStorage.setItem(this.key,JSON.stringify(state));}
};
export const explorationSource={list(trip){return [...places,...(trip?.customPlaces||[])];}};
export const mapProvider={kind:'schematic',navigationUrl(place){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place.city+place.district+place.name.replace('（虛構示範）',''));}};
