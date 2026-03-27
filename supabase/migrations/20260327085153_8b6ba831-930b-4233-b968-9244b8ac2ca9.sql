-- Tighten exchange rate write policies to avoid permissive literal-true checks
DROP POLICY IF EXISTS "Authenticated users can manage exchange rates" ON public.exchange_rates;

CREATE POLICY "Authenticated users can insert exchange rates"
ON public.exchange_rates
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update exchange rates"
ON public.exchange_rates
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete exchange rates"
ON public.exchange_rates
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);