//FIXME we could move this into constructor 
// and switch it to WS 

import {uberFetch,untilTrue,CONFIG,COMMON,DEBUG} from '../common.js';
import DEFAULT_FAVICON from '../subviews/faviconDataURL.js';

const STATE_SYMBOL = Symbol(`[[State]]`);
const MODAL_MESSAGE = `RBI is paused, probably because a modal dialog is open. It's alright, this happens sometimes. Before you leave a page, remember to close any modal dialogs. You can also try again to close the last one that was open.`;
let modaler;
let active;

export async function fetchTabs({sessionToken}, getState) {
  DEBUG.debugTabs && console.log(`Fetch tabs called`);
  try {
    const url = new URL(location);
    url.pathname = '/api/v7/tabs';
    const resp = await uberFetch(url);
    if ( resp.ok ) {
      const data = await resp.json();
      if ( data.error ) {
        if ( data.resetRequired ) {
          const state = getState();
          if ( ! state.connected ) {
            if ( CONFIG.isCT ) {
              alert(`Your session expired. You can buy more time starting from $1/hour`);
              location.href = 'https://browse.cloudtabs.net/extend'
            } else {
              alert(`Your session has expired or disconnected.`);
            }
          } else {
            alert(`An error occurred. You might need to reload the page, or switch your remote browser off then on again. That is all we know.`);
          }
        }
      } 
      if ( data.vmPaused ) {
        let {modal} = data;
        DEBUG.debugModal && console.log('Remote Browser VM is paused. Probably because a modal dialog is open.');  
        if (modal) {
          if ( ! active ) {
            clearTimeout(modaler);
            modaler = setTimeout(async () => {
              if ( active ) return;
              active = true;
              const state = getState();
              DEBUG.debugModal && console.log({modal, 1:true});
              await untilTrue(() => !!state?.viewState?.modalComponent, 100, 1000);
              DEBUG.debugModal && console.log({modal, 2:true});
              state.viewState.modalComponent.openModal({modal});
              DEBUG.debugModal && console.log({modal, 3:true});
              await untilTrue(() => !state?.viewState?.currentModal, 100, 1000).then(() => {
                active = false;
                DEBUG.debugModal && console.log('Active is now false.');
              });
              DEBUG.debugModal && console.log({modal, 4:true});
            }, 0);
          }
        }
      }
      DEBUG.debugBetterModals && console.log(data);
      if ( data.tabs ) {
        data.tabs = (data.tabs || []).filter(({type}) => type == 'page');
        data.tabs = data.tabs.map(tab => new Tab(tab, {getState}));
      }
      DEBUG.debugTabs && console.log(data);
      return data;
    } else if ( resp.status == 401 ) {
      console.warn(`Session has been cleared. Let's attempt relogin`, sessionToken);
      const x = new URL(location);
      x.pathname = 'login';
      x.search = `token=${sessionToken}&ran=${Math.random()}`;
      COMMON.blockAnotherReset = true;
      alert("Your browser cleared your session. We need to reload the page to refresh it.");
      COMMON.delayUnload = false;
      if ( ! DEBUG.noReset ) {
        location.href = x;
      }
      return;
    }
  } catch(e) {
    console.warn(e);
    const state = getState();
    if ( ! state.connected ) {
      if ( CONFIG.isCT ) {
        alert(`Your session expired. You can buy more time starting from $1/hour`);
        location.href = 'https://browse.cloudtabs.net/extend'
      } else {
        alert(`Your session has expired or disconnected.`);
      }
    } 
  }
}

class Tab {
  constructor({...tabDetails}, {getState} = {}) {
    Object.assign(this, tabDetails);
    Object.defineProperty(this, STATE_SYMBOL, {
      get: () => getState()
    });
  }

  setDefaultFavicon() {
    this.faviconDataURI = DEFAULT_FAVICON;
    this.usingDefaultFavicon = true;
  }

  get faviconDataURI() {
    return this[STATE_SYMBOL].favicons.get(this.targetId)?.dataURI; 
  }

  set faviconDataURI(dataURI) {
    this[STATE_SYMBOL].favicons.set(
      this.targetId,
      Object.assign(
        this[STATE_SYMBOL].favicons.get(this.targetId) || {}, 
        {dataURI}
      )
    );
    this.usingDefaultFavicon = false;
  }

  get favicon() {
    return this[STATE_SYMBOL].favicons.get(this.targetId)?.favicon; 
  }

  set favicon(favicon) {
    this[STATE_SYMBOL].favicons.set(
      this.targetId,
      Object.assign(
        this[STATE_SYMBOL].favicons.get(this.targetId) || {}, 
        {favicon}
      )
    );
  }
}
