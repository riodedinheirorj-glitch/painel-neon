import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, name, cellphone, email, taxId, description } = await req.json();

    if (!amount || !name || !cellphone || !email || !taxId) {
      throw new Error('Campos obrigatórios: amount, name, cellphone, email, taxId');
    }

    const ABACATE_PAY_API_KEY = Deno.env.get('ABACATE_PAY_API_KEY');
    if (!ABACATE_PAY_API_KEY) {
      throw new Error('ABACATE_PAY_API_KEY não configurada');
    }

    console.log('Creating PIX QR Code for:', { amount, name, email });

    const response = await fetch('https://api.abacatepay.com/v1/pixQrCode/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ABACATE_PAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Converter para centavos
        expiresIn: 3600, // 1 hora
        description: description || `Compra de créditos - R$ ${amount}`,
        customer: {
          name: name,
          cellphone: cellphone,
          email: email,
          taxId: taxId,
        },
        metadata: {
          externalId: `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        }
      }),
    });

    const data = await response.json();
    
    if (!response.ok || data.error) {
      console.error('Abacate Pay error:', data.error);
      throw new Error(data.error?.message || 'Erro ao gerar QR Code PIX');
    }

    console.log('PIX QR Code created successfully:', data.data.id);

    return new Response(
      JSON.stringify({
        qrCodeImage: data.data.brCodeBase64,
        pixCopyPasteCode: data.data.brCode,
        transactionId: data.data.id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error creating PIX QR Code:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
