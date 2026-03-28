// api/parse-order.js — Vercel serverless function
// Requires ANTHROPIC_API_KEY environment variable in Vercel project settings

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables' })
  }

  const { type, content, boardModels = [] } = req.body

  const systemPrompt = `You are an expert at extracting surfboard order information from text, screenshots, emails, and handwritten forms.

Extract order data and return ONLY valid JSON with these exact fields (use null for missing fields):
{
  "customer_name": string,
  "customer_email": string,
  "customer_phone": string,
  "shipping_address": string,
  "shaper": string,
  "shape_name": string,
  "length_ft": number (decimal feet, e.g. 6.2 for 6'2"),
  "width_in": number (decimal inches, e.g. 19.5),
  "thickness_in": number (decimal inches, e.g. 2.5),
  "volume_l": number,
  "colour": string,
  "fin_setup": string (one of: Single, Twin, Thruster, Quad, Five, 2+1),
  "fin_system": string (one of: FCS II, Futures, US Box, Glassed in),
  "tail_shape": string (one of: Round, Squash, Square, Pin, Swallow, Bat, Fish, Asymmetric),
  "sale_price": number,
  "notes": string
}

Known board models for this manufacturer: ${boardModels.join(', ') || 'none specified'}

IMPORTANT: 
- Convert feet/inches notation (e.g. 6'2" or 6-2) to decimal feet for length_ft
- Return ONLY the JSON object, no markdown, no explanation
- If you see a price, extract it as a number (no currency symbols)
- Fin setup and system should match exactly one of the provided options`

  let messages = []

  if (type === 'image') {
    // Screenshot or scan form
    messages = [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: content.mediaType || 'image/jpeg',
            data: content.data,
          }
        },
        {
          type: 'text',
          text: 'Extract the surfboard order information from this image and return as JSON.'
        }
      ]
    }]
  } else {
    // Text (email, pasted text)
    messages = [{
      role: 'user',
      content: `Extract the surfboard order information from this text and return as JSON:\n\n${content}`
    }]
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(500).json({ error: 'AI parsing failed', details: err })
    }

    const result = await response.json()
    const text = result.content?.[0]?.text ?? ''

    // Parse the JSON response
    let parsed
    try {
      // Strip any markdown fences just in case
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch(e) {
      console.error('JSON parse error:', e, 'Raw text:', text)
      return res.status(500).json({ error: 'Could not parse AI response as JSON', raw: text })
    }

    return res.status(200).json({ data: parsed })

  } catch(e) {
    console.error('Parse order error:', e)
    return res.status(500).json({ error: e.message })
  }
}
