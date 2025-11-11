import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";
const RATE_LIMIT_DELAY = 1100; // 1.1 seconds to respect 1 request per second limit
const DEFAULT_COUNTRY_CODE = "br";

// Helpers
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

function normalizeText(s: string | undefined | null): string {
  if (!s) return "";
  const withNoAccents = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return withNoAccents.toLowerCase()
    .replace(/(av|av\.|avenida)\b/g, "avenida")
    .replace(/\b(r|r\.)\b/g, "rua")
    .replace(/(rod|rod\.|rodovia)\b/g, "rodovia")
    .replace(/\b(proximo a|proximo|próximo a|perto de|em frente ao|ao lado de)\b/g, "")
    .replace(/[^\w\s\-\,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface InputAddressRow {
  rawAddress?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  [key: string]: any;
}

function buildStructuredParams(row: InputAddressRow): string {
  const street = normalizeText(row.rawAddress || "");
  const city = normalizeText(row.cidade || "");
  const state = normalizeText(row.estado || "");
  const country = DEFAULT_COUNTRY_CODE;
  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    limit: "1",
    countrycodes: country
  });
  if (street) params.append("street", street);
  if (city) params.append("city", city);
  if (state) params.append("state", state);
  return params.toString();
}

function buildFreeTextParam(row: InputAddressRow): string {
  const parts = [];
  if (row.rawAddress) parts.push(row.rawAddress);
  if (row.bairro) parts.push(row.bairro);
  if (row.cidade) parts.push(row.cidade);
  if (row.estado) parts.push(row.estado);
  return new URLSearchParams({
    q: parts.join(", "),
    format: "json",
    addressdetails: "1",
    limit: "1",
    countrycodes: DEFAULT_COUNTRY_CODE
  }).toString();
}

interface NominatimAddressDetails {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  suburb?: string;
  neighbourhood?: string;
  state?: string;
  [key: string]: any;
}

interface ExpectedAddressDetails {
  bairro?: string;
  cidade?: string;
  estado?: string;
}

function addressMatchesExpected(nominatimAddress: NominatimAddressDetails | undefined, expected: ExpectedAddressDetails): boolean {
  if (!nominatimAddress) return false;

  const gotCity = (nominatimAddress.city || nominatimAddress.town || nominatimAddress.village || "");
  const gotCounty = nominatimAddress.county || "";
  const gotSuburb = nominatimAddress.suburb || nominatimAddress.neighbourhood || "";
  const gotState = nominatimAddress.state || "";

  const expCity = normalizeText(expected.cidade || "");
  const expBairro = normalizeText(expected.bairro || "");
  const expState = normalizeText(expected.estado || "");

  const gCity = normalizeText(gotCity || gotCounty);
  const gBairro = normalizeText(gotSuburb || "");
  const gState = normalizeText(gotState || "");

  const cityMatches = expCity && gCity && (gCity.includes(expCity) || expCity.includes(gCity));
  const stateMatches = (!expState) || (gState && (gState.includes(expState) || expState.includes(expState)));

  let bairroMatches = false;
  if (!expBairro) bairroMatches = true;
  else if (gBairro) {
    bairroMatches = (gBairro.includes(expBairro) || expBairro.includes(expBairro));
  } else {
    bairroMatches = false;
  }

  return cityMatches && stateMatches && bairroMatches;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddressDetails;
  [key: string]: any;
}

async function nominatimSearch(paramsString: string): Promise<NominatimResult | null> {
  const url = `${NOMINATIM_API_URL}?${paramsString}`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "RotaSmartApp/1.0 (contact@rotasmart.com)"
    }
  });
  if (!resp.ok) {
    console.error("Nominatim API error:", resp.status, resp.statusText, url);
    throw new Error("Nominatim returned " + resp.status);
  }
  const json: NominatimResult[] = await resp.json();
  return json && json.length ? json[0] : null;
}

export interface ProcessedAddress {
  originalAddress: string;
  correctedAddress?: string;
  latitude?: string;
  longitude?: string;
  status: 'valid' | 'corrected' | 'pending' | 'mismatch';
  searchUsed?: string;
  note?: string;
  display_name?: string;
  [key: string]: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { addresses } = await req.json();

    if (!Array.isArray(addresses)) {
      throw new Error('Input must be an array of addresses.');
    }

    const results: ProcessedAddress[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const row: InputAddressRow = addresses[i];
      let searchUsed = "";
      let found: NominatimResult | null = null;
      let status: ProcessedAddress['status'] = "pending";
      let note = "";

      // 1) Try structured search (street+city+state)
      try {
        const structured = buildStructuredParams(row);
        searchUsed = "structured:" + decodeURIComponent(structured);
        found = await nominatimSearch(structured);
        await sleep(RATE_LIMIT_DELAY);
      } catch (e) {
        note = "erro-na-requisicao-structured";
        console.warn(e);
      }

      // 2) If not found, try a normalized free-text search (with bairro/cidade appended)
      if (!found) {
        try {
          const free = buildFreeTextParam(row);
          searchUsed = "freetext:" + decodeURIComponent(free);
          found = await nominatimSearch(free);
          await sleep(RATE_LIMIT_DELAY);
        } catch (e) {
          note = (note ? note + ";" : "") + "erro-na-requisicao-freetext";
          console.warn(e);
        }
      }

      // 3) If found, validate city/bairro/state vs planilha
      if (found) {
        const addr = found.address || {};
        const matches = addressMatchesExpected(addr, { bairro: row.bairro, cidade: row.cidade, estado: row.estado });
        if (matches) {
          status = "valid";
          note = "matches-planilha";
        } else {
          // Try a corrective attempt: sanitize address text and retry including explicit city param only
          try {
            const correctedParams = new URLSearchParams({
              street: normalizeText(row.rawAddress || ""),
              city: normalizeText(row.cidade || ""),
              format: "json",
              addressdetails: "1",
              limit: "1",
              countrycodes: DEFAULT_COUNTRY_CODE
            }).toString();
            searchUsed = "retry-corrected:" + decodeURIComponent(correctedParams);
            const retr = await nominatimSearch(correctedParams);
            await sleep(RATE_LIMIT_DELAY);
            if (retr && addressMatchesExpected(retr.address || {}, { bairro: row.bairro, cidade: row.cidade, estado: row.estado })) {
              found = retr;
              status = "corrected";
              note = "retry-corrected-success";
            } else {
              status = "mismatch";
              note = "resultado-nao-coincide-com-cidade-bairro";
            }
          } catch (e) {
            note = (note ? note + ";" : "") + "erro-na-requisicao-retry";
            status = "mismatch";
            console.warn(e);
          }
        }
      } else {
        status = "pending";
        note = note || "nao-encontrado";
      }

      results.push({
        ...row,
        originalAddress: row.rawAddress || "",
        correctedAddress: (status === 'valid' || status === 'corrected') ? (found?.display_name || row.rawAddress) : row.rawAddress,
        latitude: found ? found.lat : undefined,
        longitude: found ? found.lon : undefined,
        status,
        searchUsed,
        note,
        display_name: found ? found.display_name : undefined
      });
    }

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in batch-geocode function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});