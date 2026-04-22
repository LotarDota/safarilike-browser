import { Session, net } from 'electron';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { rendererIndex } from './paths';
import { INTERNAL_SCHEME } from '../shared/constants';

/**
 * Maps `clover://<page>` URLs to bundled renderer entry points so that
 * new tabs, settings, reader mode, etc. can be reached the way Safari maps
 * `apple://settings`.
 */
export function registerInternalProtocol(session: Session): void {
  session.protocol.handle(INTERNAL_SCHEME, async (request) => {
    const url = new URL(request.url);
    const host = url.hostname;

    const mapping: Record<string, () => string> = {
      newtab: () => rendererIndex('newtab'),
      settings: () => rendererIndex('settings'),
      reader: () => rendererIndex('reader'),
      error: () => rendererIndex('newtab'),
    };

    const page = mapping[host];
    const filePath = page
      ? page()
      : path.join(path.dirname(rendererIndex('newtab')), url.pathname.replace(/^\//, ''));

    return net.fetch(pathToFileURL(filePath).toString());
  });
}
