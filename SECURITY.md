# Security Guidelines

## Environment Variables

### CRITICAL: Protecting API Keys

This project uses Supabase and other third-party APIs. **Never commit API keys or secrets to version control.**

### Setup Instructions

1. Copy the example environment files:
   ```bash
   cp .env.example .env
   cp web/.env.example web/.env
   ```

2. Fill in your actual credentials in the `.env` files

3. Verify `.env` files are in `.gitignore` (they are by default)

4. **Before committing**, run:
   ```bash
   git status
   ```
   Make sure no `.env` files appear in the changes

### Production Deployment

For production deployments:
- Use your hosting platform's environment variable system (Vercel, Netlify, etc.)
- Never include `.env` files in production builds
- Rotate API keys if they were accidentally exposed

## API Key Security

### Public vs Secret Keys

- **VITE_SUPABASE_ANON_KEY**: Safe to expose in frontend (has Row Level Security)
- **SUPABASE_SERVICE_ROLE_KEY**: NEVER expose to frontend (only use in Edge Functions)
- **GROQ_API_KEY**: Only use in Edge Functions, never in frontend
- **VITE_GEMINI_API_KEY**: Currently exposed in frontend - consider moving to Edge Function

### Row Level Security (RLS)

All Supabase tables should have RLS enabled. Current implementation:
- `profiles` table has RLS with user-specific policies
- Users can only view/edit their own profile
- Admin operations should be done via Edge Functions

## Data Validation

### Client-Side Validation
All user inputs are validated in the frontend, but this is NOT sufficient for security.

### Server-Side Validation
Critical operations should be validated in Supabase Edge Functions:
- Stock transactions (see `validate-inventory` function)
- Sales calculations (see `validate-sale` function)
- User permissions

## Common Vulnerabilities to Avoid

### 1. SQL Injection
- ✅ Using Supabase client (parameterized queries)
- ❌ Never concatenate user input into SQL

### 2. XSS (Cross-Site Scripting)
- ✅ React escapes content by default
- ❌ Be careful with `dangerouslySetInnerHTML`

### 3. Authentication Bypass
- ✅ Always verify user session server-side
- ✅ Check user roles in Edge Functions
- ❌ Don't trust client-side role checks alone

### 4. Insufficient Authorization
- ✅ Implement role-based access control (RBAC)
- ✅ Filter sensitive data by user role
- ❌ Don't expose cost data to Sales role

## Reporting Security Issues

If you discover a security vulnerability, please email: security@example.com

Do NOT create a public GitHub issue for security vulnerabilities.

## Security Checklist for Deployment

- [ ] All `.env` files are in `.gitignore`
- [ ] Production uses environment variables, not `.env` files
- [ ] Supabase RLS is enabled on all tables
- [ ] Edge Functions validate all critical operations
- [ ] API keys have been rotated if ever committed
- [ ] HTTPS is enforced in production
- [ ] Content Security Policy (CSP) headers are configured
- [ ] Regular dependency updates with `npm audit fix`
