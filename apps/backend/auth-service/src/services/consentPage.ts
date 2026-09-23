import type { ApiKeyScope } from '@tumbaland/backend-core';

const scopeLabel = (scope: string): string => {
  const [area, access] = scope.split(':');
  const areas: Record<string, string> = {
    relationship: 'your journal',
    album: 'your photos',
    finance: 'your finances'
  };
  return `${access === 'write' ? 'Add to and change' : 'Read'} ${areas[area] ?? area}`;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

export interface ConsentPageInput {
  /** Where the form posts its decision. */
  action: string;
  clientName?: string;
  clientId: string;
  redirectUri: string;
  state?: string;
  scopes: ApiKeyScope[];
  resource: string;
  codeChallenge: string;
  consentToken: string;
  /** Every tenant the approver could pick, in the order they are listed. */
  tenants: string[];
  tenantNames: Record<string, string>;
  suggestedDefault: string;
  email: string;
}

/** The consent screen the authorization endpoint shows a signed-in user. */
export const renderConsentPage = (input: ConsentPageInput): string => {
  const { tenants, tenantNames: names, suggestedDefault } = input;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Tumbaland</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f6f6f7;margin:0;padding:2rem;color:#1a1a1a}
  .card{max-width:26rem;margin:2rem auto;background:#fff;border-radius:12px;padding:1.75rem;
        box-shadow:0 1px 3px rgba(0,0,0,.1)}
  h1{font-size:1.25rem;margin:0 0 .25rem}
  p.sub{color:#666;margin:0 0 1.25rem;font-size:.9rem}
  ul{list-style:none;padding:0;margin:0 0 1.25rem}
  li{padding:.5rem .75rem;background:#f2f7ff;border-radius:8px;margin-bottom:.4rem;font-size:.9rem}
  label{display:block;font-size:.85rem;color:#444;margin:0 0 .35rem}
  select{width:100%;padding:.55rem;border:1px solid #ccc;border-radius:8px;margin-bottom:1.25rem}
  .tenants{margin:0 0 1rem}
  .tenant{display:flex;align-items:center;gap:.55rem;padding:.5rem .75rem;background:#fafafa;
          border:1px solid #eee;border-radius:8px;margin-bottom:.35rem;font-size:.9rem;color:#1a1a1a}
  .tenant input{margin:0}
  .row{display:flex;gap:.6rem}
  button{flex:1;padding:.7rem;border-radius:8px;border:0;font-size:.95rem;cursor:pointer}
  .approve{background:#1a73e8;color:#fff}
  .deny{background:#eee;color:#333}
  .who{font-size:.8rem;color:#888;margin-top:1rem;text-align:center}
</style></head><body>
<div class="card">
  <h1>Connect ${escapeHtml(input.clientName ?? 'an application')}</h1>
  <p class="sub">It is asking to access your Tumbaland account.</p>
  <ul>${input.scopes.map((s) => `<li>${escapeHtml(scopeLabel(s))}</li>`).join('')}</ul>
  <form method="POST" action="${escapeHtml(input.action)}">
    <label>Which data may it act on?</label>
    <div class="tenants">
      ${tenants
        .map(
          (tenant) => `<label class="tenant">
        <input type="checkbox" name="tenant" value="${escapeHtml(tenant)}" checked>
        <span>${escapeHtml(names[tenant] ?? tenant)}</span>
      </label>`
        )
        .join('')}
    </div>
    <label for="defaultTenant">When it is not told which, use</label>
    <select id="defaultTenant" name="defaultTenant">
      ${tenants
        .map(
          (tenant) =>
            `<option value="${escapeHtml(tenant)}"${tenant === suggestedDefault ? ' selected' : ''}>${escapeHtml(names[tenant] ?? tenant)}</option>`
        )
        .join('')}
    </select>
    <input type="hidden" name="client_id" value="${escapeHtml(input.clientId)}">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(input.redirectUri)}">
    <input type="hidden" name="scope" value="${escapeHtml(input.scopes.join(' '))}">
    <input type="hidden" name="resource" value="${escapeHtml(input.resource)}">
    <input type="hidden" name="code_challenge" value="${escapeHtml(input.codeChallenge)}">
    <input type="hidden" name="state" value="${escapeHtml(input.state ?? '')}">
    <input type="hidden" name="consent_token" value="${escapeHtml(input.consentToken)}">
    <div class="row">
      <button type="submit" name="decision" value="deny" class="deny">Cancel</button>
      <button type="submit" name="decision" value="approve" class="approve">Connect</button>
    </div>
  </form>
  <p class="who">Signed in as ${escapeHtml(input.email)}</p>
</div></body></html>`;
};
