import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import extensions from 'virtual:crm-extensions';
import App from './App';
import {applyBrand} from './brand';
import {createArtifactStore} from './data/artifactStore';
import {t} from './i18n';
import './styles.css';

/* Starts the app in the given element. Without the shared logic (logic.js) the app cannot run; then a plain error is
 * shown instead of an empty page. */
export function renderApp(root: HTMLElement) {
  if (!window.CRMLogic) {
    const p = document.createElement('p');
    p.setAttribute('role', 'alert');
    p.textContent = t('logicMissing');
    root.replaceChildren(p);
    return;
  }
  // The brand is applied before the first render, so the page never flashes in the wrong colours
  const brand = applyBrand();
  const app = createRoot(root);
  const show = (store?: Awaited<ReturnType<typeof createArtifactStore>>, connectFailed = false) => app.render(
    <StrictMode>
      <App brand={brand} store={store} connectFailed={connectFailed} extensions={extensions} />
    </StrictMode>
  );
  show(); // the shell at once, "loading" until the database answers
  // If connecting fails the app shows the connection error, instead of loading forever
  createArtifactStore().then(store => show(store), () => show(null, true));
}

const root = document.getElementById('root');
if (root) renderApp(root);
