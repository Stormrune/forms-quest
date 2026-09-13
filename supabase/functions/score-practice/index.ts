import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { practiceId, formSlug } = await req.json()
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Load movements with your common mistakes
  const { data: form } = await supabase.from("forms").select("id").eq("slug", formSlug).single()
  const { data: movements } = await supabase.from("movements").select("*").eq("form_id", form.id).order("movement_number")

  // For MVP: pick 2-3 random movements that have common_mistake to show real feedback
  // Later: replace this with real pose comparison using reference-poses JSON
  const mistakeMovements = movements.filter(m => m.common_mistake)
  const sampled = mistakeMovements.sort(() => 0.5 - Math.random()).slice(0, 3)

  const feedback = sampled.map(m => ({
    movement: m.movement_number,
    korean: m.korean_name,
    english: m.english_name,
    issue: m.common_mistake,
    coaching: `Check ${m.english_name} - ${m.common_mistake.toLowerCase()}`,
    score: Math.floor(55 + Math.random() * 30)
  }))

  // If no mistakes sampled, add generic
  if (feedback.length === 0) {
    feedback.push({
      movement: 5,
      korean: "ap kubi arae makgi",
      english: "long stance low block",
      issue: "Stance length",
      coaching: "Lengthen your front stance",
      score: 70
    })
  }

  const power = Math.floor(60 + Math.random() * 25)
  const focus = Math.floor(68 + Math.random() * 20)
  const rhythm = Math.floor(65 + Math.random() * 20)
  const total = Math.floor((power + focus + rhythm) / 3)

  const breakdown = { total, power, focus, rhythm, perMovement: feedback }

  // Update practice
  await supabase.from("practices").update({
    score: total,
    breakdown
  }).eq("id", practiceId)

  return new Response(JSON.stringify(breakdown), { headers: { "Content-Type": "application/json" } })
})