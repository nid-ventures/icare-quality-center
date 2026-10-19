// Test de charge de l'API iCare (k6) : des utilisateurs virtuels enchaînent les appels faits par
// l'application (configuration, liste des patients, factures, actes, honoraires), en lecture seule.
//
//   npm run perf:charge                      (local, 10 utilisateurs, 1 min)
//   k6 run -e TARGET=dev -e VUS=50 -e DURATION=3m perf/k6/charge.js
//
// Variables (-e NOM=valeur) :
//   TARGET    local (défaut) | dev | test : API et Keycloak visés
//   VUS       utilisateurs simultanés au palier (défaut 10)
//   DURATION  durée du palier (défaut 1m), précédée d'une montée et suivie d'une descente
//   ICARE_USER / ICARE_PASSWORD / ICARE_HI_CODE  compte utilisé (défaut : administrateur de structure des
//             tests) ; pas USERNAME, déjà défini par Windows (nom de la session)
//
// Ne jamais viser la production, ni un serveur partagé sans l'accord de l'équipe.
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const TARGETS = {
  local: {
    api: 'https://nid-dev.localhost.com:9090/nid-api/v1',
    oauth: 'https://keycloak.pro-icare.com/realms/icare/protocol/openid-connect/token',
  },
  dev: {
    api: 'https://backend.icare-nestlabs-test.net:9090/nid-api/v1',
    oauth: 'https://keycloak.icare-nestlabs-test.net/realms/icare/protocol/openid-connect/token',
  },
  test: {
    api: 'https://backend.pro-icare.com:9090/nid-api/v1',
    oauth: 'https://keycloak.pro-icare.com/realms/icare/protocol/openid-connect/token',
  },
};

const target = TARGETS[__ENV.TARGET || 'local'];
if (!target) throw new Error(`TARGET inconnu : ${__ENV.TARGET} (local, dev ou test)`);
const VUS = Number(__ENV.VUS) || 10;
const DURATION = __ENV.DURATION || '1m';
const USERNAME = __ENV.ICARE_USER || 'hi-admin@gmail.com';
const PASSWORD = __ENV.ICARE_PASSWORD || 'BcIsX7V&ZRh7';
const HI_CODE = __ENV.ICARE_HI_CODE || 'NEST';

export const options = {
  // Certificat auto-signé du backend local
  insecureSkipTLSVerify: true,
  stages: [
    { duration: '30s', target: VUS },
    { duration: DURATION, target: VUS },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    // Moins de 1 % d'erreurs
    http_req_failed: ['rate<0.01'],
    // 95 % des réponses de chaque appel sous le seuil (la liste des patients est la plus lourde)
    'http_req_duration{appel:configuration}': ['p(95)<3000'],
    'http_req_duration{appel:patients}': ['p(95)<8000'],
    'http_req_duration{appel:factures-patients}': ['p(95)<2000'],
    'http_req_duration{appel:factures-garants}': ['p(95)<2000'],
    'http_req_duration{appel:actes}': ['p(95)<2000'],
    'http_req_duration{appel:honoraires}': ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

/** Jeton obtenu une fois auprès de Keycloak (comme le front), partagé par les utilisateurs virtuels. */
export function setup() {
  const res = http.post(target.oauth, {
    grant_type: 'password', client_id: 'icare-hi-front', username: USERNAME, password: PASSWORD,
  });
  if (res.status !== 200) throw new Error(`Connexion Keycloak refusée : HTTP ${res.status} ${res.body}`);
  return { token: res.json('access_token') };
}

function appel(data, nom, method, url, body) {
  const params = {
    headers: { Authorization: `Bearer ${data.token}`, 'X-HI-CODE': HI_CODE, 'Content-Type': 'application/json' },
    tags: { appel: nom },
    timeout: '60s',
  };
  const res = method === 'GET'
    ? http.get(target.api + url, params)
    : http.post(target.api + url, JSON.stringify(body), params);
  check(res, {
    [`${nom} : HTTP 200`]: r => r.status === 200,
    [`${nom} : code 200`]: r => { try { return r.json('code') === 200; } catch (e) { return false; } },
  });
  return res;
}

/** Pause « lecture de l'écran » entre deux actions d'un utilisateur. */
const pause = () => sleep(1 + Math.random() * 2);

export default function (data) {
  group('Ouverture de session', () => {
    appel(data, 'configuration', 'GET', `/modules/loadconfigs?username=${encodeURIComponent(USERNAME)}&domain=COUNTRY`);
  });
  pause();
  group('Base patients', () => {
    appel(data, 'patients', 'POST', '/patients/getAll', {
      active: true, page: 1, size: 20, firstName: '', lastName: '', email: '', doB: 0, patientIdentifier: '',
      nidIdentifier: '', middleName: '', sex: null, phone: '', city: null, tz: 0, gender: 0, inactive: false,
    });
  });
  pause();
  group('Facturation', () => {
    appel(data, 'factures-patients', 'POST', '/invoices/patients', { pageNo: 1, pageSize: 20 });
    appel(data, 'factures-garants', 'POST', '/invoices/garants', { pageNo: 1, pageSize: 20 });
  });
  pause();
  group('Reporting', () => {
    appel(data, 'actes', 'POST', '/billableacts/search', { pageNo: 1, pageSize: 20, dateStart: 0, dateEnd: 0, patientDob: 0, status: null });
  });
  pause();
  group('Honoraires', () => {
    appel(data, 'honoraires', 'POST', '/feestatements/search/paged', { pageNo: 1, pageSize: 10, active: true });
  });
  pause();
}
