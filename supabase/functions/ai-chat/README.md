# AI Chat Edge Function

## Description
Provides AI-powered business insights using Groq's Llama 3.1 8B Instant model for Azmol Stock ERP.

## Features
- ✅ Secure authentication via Supabase JWT
- ✅ Role-based access control (Admin, Manager, Sales, Delivery, Cashier)
- ✅ Rate limiting: 20 requests per minute per user
- ✅ Context optimization for cost reduction
- ✅ Multi-language support (ES, FR, EN, AR)
- ✅ CORS enabled for frontend access

## Authentication
Requires valid Supabase JWT token in Authorization header.

## Rate Limiting
- **Limit:** 20 requests per minute per user
- **Window:** 60 seconds (resets automatically)
- **Response:** HTTP 429 when limit exceeded

## Environment Variables
- `GROQ_API_KEY` - Groq API key (set via `supabase secrets set`)
- `SUPABASE_URL` - Supabase project URL (auto-injected)
- `SUPABASE_ANON_KEY` - Supabase anon key (auto-injected)

## Request Format
```json
{
  "message": "¿Cuáles son los productos con stock bajo?",
  "context": {
    "products": [...],
    "sales": [...],
    "warehouses": [...],
    "customers": [...],
    "transfers": [...],
    "userRole": "Admin"
  },
  "conversationHistory": [
    { "role": "user", "content": "Previous question" },
    { "role": "assistant", "content": "Previous answer" }
  ]
}
```

## Response Format
```json
{
  "response": "Based on current data, the following products have low stock:\n• Product A (5 units)\n• Product B (3 units)\nRecommendation: Reorder immediately.",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 80,
    "total_tokens": 230
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Error Response
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Role-Based Data Filtering

| Role | Access to Cost Data | Access to Sales Data | Access to Stock Data |
|------|---------------------|----------------------|----------------------|
| Admin | ✅ Full | ✅ Full | ✅ Full |
| Manager | ✅ Full | ✅ Full | ✅ Full |
| Sales | ❌ No | ✅ Full | ✅ View only |
| Delivery | ❌ No | ❌ No | ✅ Full |
| Cashier | ❌ No | ✅ Limited | ✅ View only |

## Context Optimization

To reduce API costs, the function automatically limits context size:
- **Products:** Max 100 items
- **Sales:** Max 50 items
- **Conversation history:** Last 6 messages (3 exchanges)

## Deployment

### 1. Set API Key
```bash
supabase secrets set GROQ_API_KEY=your_groq_api_key_here
```

### 2. Deploy Function
```bash
supabase functions deploy ai-chat
```

### 3. Verify Deployment
```bash
supabase functions list
```

## Testing

### Local Testing
```bash
supabase functions serve ai-chat
```

### Remote Testing
```bash
curl -X POST 'https://mkehxermgmdqsogmlaqq.supabase.co/functions/v1/ai-chat' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type': application/json' \
  -d '{
    "message": "Test message",
    "context": {
      "products": [],
      "sales": []
    }
  }'
```

## Cost Estimation

**Model:** llama-3.1-8b-instant
- **Input:** ~$0.05 per 1M tokens
- **Output:** ~$0.08 per 1M tokens

**Average request:**
- Context: ~500 tokens
- Response: ~200 tokens
- **Cost per request:** ~$0.00004

**Monthly estimates:**
- 1,000 requests: ~$0.04
- 10,000 requests: ~$0.40
- 100,000 requests: ~$4.00

## Security

- ✅ API Key never exposed to frontend
- ✅ JWT authentication required
- ✅ Role-based data filtering in backend
- ✅ Rate limiting to prevent abuse
- ✅ Input validation and sanitization

## Monitoring

### View Logs
Supabase Dashboard → Functions → ai-chat → Logs

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Unauthorized" | Missing/invalid JWT | Ensure user is logged in |
| "GROQ_API_KEY not configured" | Missing API key | Run `supabase secrets set` |
| "Rate limit exceeded" | Too many requests | Wait 60 seconds |
| "Groq API error: 401" | Invalid API key | Check Groq dashboard |
| "Groq API error: 429" | Groq rate limit | Wait or upgrade plan |

## Maintenance

- Review logs weekly
- Monitor token usage in Groq dashboard
- Update system prompts based on user feedback
- Consider Redis for rate limiting in production

## Support

For issues or questions, contact the development team or check the main project documentation.
