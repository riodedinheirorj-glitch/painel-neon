import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactionId } = await req.json();

    if (!transactionId) {
      throw new Error('Transaction ID é obrigatório');
    }

    const ABACATE_PAY_API_KEY = Deno.env.get('ABACATE_PAY_API_KEY');
    if (!ABACATE_PAY_API_KEY) {
      throw new Error('ABACATE_PAY_API_KEY não configurada');
    }

    console.log('Checking payment status for transaction:', transactionId);

    // Corrigido: usar query parameter ao invés de path parameter
    const url = `https://api.abacatepay.com/v1/pixQrCode/check?id=${transactionId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ABACATE_PAY_API_KEY}`,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Abacate Pay error:', data.error);
      throw new Error(data.error?.message || 'Erro ao verificar pagamento');
    }

    console.log('Payment status:', data.data?.status);

    // Se o pagamento foi confirmado, adicionar créditos automaticamente
    if (data.data?.status === 'PAID') {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Supabase credentials not configured');
      } else {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // Buscar a compra pendente com este transactionId
        const { data: purchase, error: purchaseError } = await supabase
          .from('credit_purchases')
          .select('*')
          .eq('gateway_charge_id', transactionId)
          .eq('status', 'pending')
          .maybeSingle();
        
        if (purchaseError) {
          console.error('Error fetching purchase:', purchaseError);
        } else if (purchase) {
          console.log('Found pending purchase:', purchase.id);
          
          // Atualizar status da compra para approved
          const { error: updateError } = await supabase
            .from('credit_purchases')
            .update({
              status: 'approved',
              approved_at: new Date().toISOString()
            })
            .eq('id', purchase.id);
          
          if (updateError) {
            console.error('Error updating purchase:', updateError);
          } else {
            console.log('Purchase approved, adding credits to user');
            
            // Adicionar créditos ao usuário usando a função add_credits
            const { data: result, error: creditsError } = await supabase
              .rpc('add_credits', {
                user_id: purchase.user_id,
                credits_to_add: purchase.credits
              });
            
            if (creditsError) {
              console.error('Error adding credits:', creditsError);
            } else {
              console.log('Credits added successfully:', result);
              
              // Registrar transação
              await supabase.from('transactions').insert({
                user_id: purchase.user_id,
                type: 'purchase',
                amount: purchase.credits,
                description: `Compra de ${purchase.credits} créditos via PIX`
              });
            }
          }
        } else {
          console.log('No pending purchase found for transaction:', transactionId);
        }
      }
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error checking payment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
