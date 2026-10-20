/* Chooses the store for where the page runs: the artifact database on claude.ai, otherwise the REST API on the same
 * address (localhost or the cloud), otherwise none (the list then says the register is not available here). */
import {createArtifactStore, type ClaudeRuntime} from './artifactStore';
import {createRestStore} from './restStore';
import type {Store} from './store';

export async function connectStore(
  claude: ClaudeRuntime | undefined = (window as unknown as {claude?: ClaudeRuntime}).claude,
  doFetch?: (url: string, init?: RequestInit) => Promise<Response>
): Promise<Store | null> {
  // Without doFetch the REST store uses the page's own fetch
  return (await createArtifactStore(claude)) ?? createRestStore(doFetch ? {fetch: doFetch} : {});
}
