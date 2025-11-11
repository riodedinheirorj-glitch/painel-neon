import { supabase } from "@/integrations/supabase/client"; // Import supabase client
import { toast } from "sonner";

export const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";
export const RATE_LIMIT_DELAY = 1100; // 1.1 seconds to respect 1 request per second limit
const DEFAULT_COUNTRY_CODE = "br"; // ajuste se necessário

// Helpers (kept for potential future client-side use or reference, though not directly used by batchGeocodeAddresses)
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

function normalizeText(s: string | undefined | null): string {
  if (!s) return "";
  // lowercase, trim, remove diacritics, collapse spaces
  const withNoAccents = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return withNoAccents.toLowerCase()
    .replace(/(av|av\.|avenida)\b/g, "avenida")
    .replace(/\b(r|r\.)\b/g, "rua")
    .replace(/(rod|rod\.|rodovia)\b/g, "rodovia")
    .replace(/\b(proximo a|proximo|próximo a|perto de|em frente ao|ao lado de)\b/g, "")
    .replace(/[^\w\s\-\,]/g, "") // remove chars estranhos
    .replace(/\s+/g, " ")
    .trim();
}

interface InputAddressRow {
  rawAddress?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  [key: string]: any; // Allow other original fields
}

// These functions are now primarily used by the Edge Function, but their types are useful.
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

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddressDetails;
  [key: string]: any;
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
  [key: string]: any; // Allow other original fields
}

/**
 * Invokes the Supabase Edge Function to geocode a batch of addresses.
 * @param addresses An array of address objects to geocode.
 * @returns A promise that resolves to an array of ProcessedAddress.
 */
export async function batchGeocodeAddresses(addresses: InputAddressRow[]): Promise<ProcessedAddress[]> {
  try {
    const { data, error } = await supabase.functions.invoke('batch-geocode', {
      body: { addresses }
    });

    if (error) {
      console.error("Edge Function 'batch-geocode' error:", error);
      throw new Error(error.message || "Erro ao geocodificar lote de endereços.");
    }

    if (!Array.isArray(data)) {
      throw new Error("Resposta inválida da Edge Function.");
    }

    return data as ProcessedAddress[];
  } catch (error) {
    console.error("Error calling batch-geocode Edge Function:", error);
    toast.error((error as Error).message || "Erro desconhecido ao processar endereços.");
    return addresses.map(addr => ({
      ...addr,
      originalAddress: addr.rawAddress || '',
      correctedAddress: addr.rawAddress,
      latitude: undefined,
      longitude: undefined,
      status: 'pending',
      note: 'Erro na geocodificação em lote'
    }));
  }
}