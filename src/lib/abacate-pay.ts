import { supabase } from "@/integrations/supabase/client";

interface PixPaymentDetails {
  amount: number;
  name: string;
  cellphone: string;
  email: string;
  taxId: string;
  description?: string;
}

interface PixQrCodeResponse {
  qrCodeImage: string;
  pixCopyPasteCode: string;
  transactionId: string;
}

export async function generatePixQrCode(details: PixPaymentDetails): Promise<PixQrCodeResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('abacate-pix-qrcode', {
      body: {
        amount: details.amount,
        name: details.name,
        cellphone: details.cellphone,
        email: details.email,
        taxId: details.taxId,
        description: details.description,
      }
    });

    if (error) {
      console.error("Edge Function error:", error);
      throw new Error(error.message || "Erro ao gerar QR Code PIX");
    }

    if (!data || !data.qrCodeImage || !data.pixCopyPasteCode || !data.transactionId) {
      throw new Error("Resposta inválida da API");
    }

    return {
      qrCodeImage: data.qrCodeImage,
      pixCopyPasteCode: data.pixCopyPasteCode,
      transactionId: data.transactionId,
    };
  } catch (error) {
    console.error("Error calling Abacate Pay:", error);
    throw error;
  }
}

export async function checkPaymentStatus(transactionId: string): Promise<{ status: string; expiresAt: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('abacate-check-payment', {
      body: { transactionId }
    });

    if (error) {
      console.error("Edge Function error:", error);
      throw new Error(error.message || "Erro ao verificar pagamento");
    }

    if (!data || !data.data) {
      throw new Error("Resposta inválida da API");
    }

    return {
      status: data.data.status,
      expiresAt: data.data.expiresAt,
    };
  } catch (error) {
    console.error("Error checking payment:", error);
    throw error;
  }
}