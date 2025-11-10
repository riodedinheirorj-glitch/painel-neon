-- Add credits column to profiles
ALTER TABLE public.profiles ADD COLUMN credits INTEGER NOT NULL DEFAULT 3;

-- Create transactions table for history
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('download', 'purchase', 'admin_add', 'admin_remove')),
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_purchases table for PIX payments
CREATE TABLE public.credit_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL,
  amount_brl DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
ON public.transactions
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
ON public.transactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert transactions
CREATE POLICY "System can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable RLS on credit_purchases
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases"
ON public.credit_purchases
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own purchases
CREATE POLICY "Users can create purchases"
ON public.credit_purchases
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all purchases
CREATE POLICY "Admins can view all purchases"
ON public.credit_purchases
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update purchases (approve/reject)
CREATE POLICY "Admins can update purchases"
ON public.credit_purchases
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update handle_new_user function to give 3 initial credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, credits)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 3);
  
  -- Give default 'user' role to new signups
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;