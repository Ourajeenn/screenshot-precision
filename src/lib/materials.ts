import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PARAMS, type Params } from "./vision";

export interface Material {
  id: string;
  name: string;
  description: string;
  aiHints: string;
  params: Params;
}

export async function fetchMaterials(): Promise<Material[]> {
  const { data, error } = await supabase.from("materials").select("id,name,description,ai_hints,params").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    aiHints: m.ai_hints,
    params: { ...DEFAULT_PARAMS, ...(m.params as Partial<Params>) },
  }));
}
