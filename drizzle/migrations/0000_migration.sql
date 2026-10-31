CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  ai_hints text NOT NULL DEFAULT '',
  params jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.materials TO anon, authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Materials readable by all" ON public.materials FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.materials (name, description, ai_hints, params) VALUES
('Tôle acier', 'Acier laminé ou peint, surface mate à semi-brillante.',
 'Surveiller oxydation/rouille (zones brun-orangé), rayures de manutention, piqûres de corrosion, écaillage de peinture. Vérifications typiques : ressuage, magnétoscopie, mesure d''épaisseur de revêtement.',
 '{"blurRadius":2,"illumination":true,"illumRadius":40,"contrast":false,"method":"sigma","sigmaK":2.5,"opening":true,"minArea":40}'),
('Aluminium', 'Aluminium brut, brossé ou anodisé, reflets fréquents.',
 'Les reflets et le brossage créent de fausses lignes : distinguer rayures réelles et reflets. Surveiller rayures, enfoncements, corrosion blanche (piqûres), défauts d''anodisation. Vérifications : éclairage rasant, ressuage, contrôle sous un autre angle.',
 '{"blurRadius":3,"illumination":true,"illumRadius":60,"contrast":false,"method":"sigma","sigmaK":3,"opening":true,"minArea":60}'),
('Plastique', 'Pièce plastique moulée ou injectée, teinte uniforme.',
 'Surveiller retassures, bulles, brûlures (traces noires), lignes de soudure, décolorations, rayures. Vérifications : contrôle dimensionnel, lumière transmise, comparaison avec une pièce de référence.',
 '{"blurRadius":2,"illumination":true,"illumRadius":40,"contrast":true,"method":"sigma","sigmaK":2.2,"opening":true,"minArea":30}');