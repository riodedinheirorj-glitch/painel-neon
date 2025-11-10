import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Geocode address using Nominatim (OpenStreetMap)
async function geocodeAddress(address: string, zipcode?: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const query = zipcode ? `${address}, ${zipcode}` : address;
    const encodedQuery = encodeURIComponent(query);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'RotaSmart-DeliveryOptimization/1.0'
        }
      }
    );

    if (!response.ok) {
      console.error("Nominatim API error:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Correct multiple addresses in a single AI call
async function correctAddressesBatchWithAI(addresses: string[], lovableApiKey: string, retries = 3): Promise<string[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const addressList = addresses.map((addr, idx) => `${idx + 1}. ${addr}`).join('\n');
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especializado em corrigir endereços brasileiros. Corrija erros de digitação, abreviações incorretas e formate cada endereço de forma padronizada. Retorne APENAS a lista numerada de endereços corrigidos, um por linha, mantendo a mesma numeração.'
            },
            {
              role: 'user',
              content: `Corrija estes endereços brasileiros:\n${addressList}`
            }
          ],
          temperature: 0.3,
        }),
      });

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 500;
        console.log(`Rate limit, aguardando ${waitTime}ms (tentativa ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        console.error("Erro API IA:", response.status);
        return addresses;
      }

      const data = await response.json();
      const correctedText = data.choices?.[0]?.message?.content?.trim();
      
      if (!correctedText) return addresses;
      
      // Parse the numbered list response
      const correctedAddresses = correctedText
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim());
      
      // Ensure we have the same number of addresses
      if (correctedAddresses.length === addresses.length) {
        return correctedAddresses;
      }
      
      return addresses;
    } catch (error) {
      console.error(`Erro correção IA (tentativa ${attempt + 1}):`, error);
      if (attempt === retries - 1) return addresses;
    }
  }
  return addresses;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rows } = await req.json();
    
    if (!rows || !Array.isArray(rows)) {
      return new Response(
        JSON.stringify({ error: 'Invalid input: rows array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Processando ${rows.length} endereços com IA otimizada`);

    // Process in larger batches for AI correction (10-15 addresses at once)
    const AI_BATCH_SIZE = 15;
    const BATCH_DELAY = 1500; // Reduced to 1.5 seconds
    const correctedRows = [];
    
    for (let batchStart = 0; batchStart < rows.length; batchStart += AI_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + AI_BATCH_SIZE, rows.length);
      const batch = rows.slice(batchStart, batchEnd);
      
      console.log(`Batch ${Math.floor(batchStart / AI_BATCH_SIZE) + 1}/${Math.ceil(rows.length / AI_BATCH_SIZE)} (${batchStart + 1}-${batchEnd})`);
      
      // Extract addresses for batch AI correction
      const addressData = batch.map((row) => {
        const addressKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('address') || 
          key.toLowerCase().includes('endereco') || 
          key.toLowerCase().includes('endereço')
        );
        
        const zipKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('zipcode') || 
          key.toLowerCase().includes('postal') ||
          key.toLowerCase().includes('cep')
        );
        
        const latKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('latitude') || 
          key.toLowerCase() === 'lat'
        );
        
        const lonKey = Object.keys(row).find(key => 
          key.toLowerCase().includes('longitude') || 
          key.toLowerCase() === 'lon' ||
          key.toLowerCase() === 'lng'
        );

        return {
          row,
          addressKey,
          zipKey,
          latKey,
          lonKey,
          originalAddress: addressKey ? String(row[addressKey] || '').trim() : '',
        };
      });

      // Batch AI correction - correct all addresses in one call
      const addresses = addressData.map(d => d.originalAddress).filter(a => a);
      const correctedAddresses = addresses.length > 0 
        ? await correctAddressesBatchWithAI(addresses, lovableApiKey)
        : [];

      // Process each row with corrected addresses
      const batchResults = await Promise.all(addressData.map(async (data, idx) => {
        const { row, addressKey, zipKey, latKey, lonKey, originalAddress } = data;
        
        if (!addressKey) return row;

        const correctedAddress = correctedAddresses[idx] || originalAddress;
        const zipcode = zipKey ? String(row[zipKey] || '').trim() : undefined;
        
        const updatedRow = { ...row };
        if (correctedAddress !== originalAddress) {
          updatedRow[addressKey] = correctedAddress;
          console.log(`✓ "${originalAddress.substring(0, 30)}..." -> "${correctedAddress.substring(0, 30)}..."`);
        }

        // Validate coordinates (in parallel with geocoding)
        if (latKey && lonKey) {
          const originalLat = parseFloat(row[latKey]);
          const originalLon = parseFloat(row[lonKey]);
          
          if (!isNaN(originalLat) && !isNaN(originalLon)) {
            const geocoded = await geocodeAddress(correctedAddress, zipcode);
            
            if (geocoded) {
              const distance = calculateDistance(
                originalLat,
                originalLon,
                geocoded.lat,
                geocoded.lon
              );
              
              if (distance > 200) {
                updatedRow[latKey] = geocoded.lat;
                updatedRow[lonKey] = geocoded.lon;
                console.log(`✓ Coords corrigidas: ${Math.round(distance)}m`);
              }
            }
          }
        }
        
        return updatedRow;
      }));
      
      correctedRows.push(...batchResults);
      
      // Shorter delay between batches
      if (batchEnd < rows.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    console.log(`✓ Correção concluída: ${correctedRows.length} endereços processados`);

    return new Response(
      JSON.stringify({ correctedRows }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in correct-addresses function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
