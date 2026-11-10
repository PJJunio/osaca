// SPDX-License-Identifier: AGPL-3.0-or-later

// Set OSACA_LANDING_DOCS_URL at build time to point at a deployed docs site.
// Without it, links open the documentation sources on GitHub.

export const SOURCE_URL = 'https://github.com/PJJunio/osaca';

const DOCS_SOURCE = `${SOURCE_URL}/blob/main/osaca_docs/src/content/docs`;
const deployedDocs = import.meta.env.OSACA_LANDING_DOCS_URL?.replace(/\/+$/, '');

export const SECURITY_MODEL_URL = deployedDocs ? `${deployedDocs}/security-model/` : `${DOCS_SOURCE}/security-model.md`;

export const SELF_HOSTING_URL = deployedDocs ? `${deployedDocs}/operator/` : `${DOCS_SOURCE}/operator/index.mdx`;
