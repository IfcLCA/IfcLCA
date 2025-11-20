# Vercel Deployment Guide for IfcLCA with Ökobaudat API

## Prerequisites

1. A Vercel account
2. Your IfcLCA repository connected to Vercel
3. MongoDB database (MongoDB Atlas recommended)
4. Clerk authentication keys
5. (Optional) Ökobaudat API key

## Environment Variables Setup

### Required Variables

In your Vercel project dashboard, go to **Settings → Environment Variables** and add:

```bash
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ifclca

# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Ökobaudat API Configuration (Optional but recommended)
OKOBAUDAT_API_URL=https://oekobaudat.de/OEKOBAU.DAT/resource
OKOBAUDAT_DATASTOCK_ID=cd2bda71-760b-4fcc-8a0b-3877c10000a8
OKOBAUDAT_API_KEY=your_api_key_here
OKOBAUDAT_API_CACHE_TTL=86400
OKOBAUDAT_API_RATE_LIMIT=100
```

### Optional Variables

```bash
# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# GitHub API (for stats)
GITHUB_TOKEN=ghp_...
```

## Ökobaudat API Setup

### Option 1: With API Key (Recommended)

1. **Obtain an API Key**
   - Visit [Ökobaudat Developer Portal](https://www.oekobaudat.de/anleitungen/softwareentwickler.html)
   - Register for developer access
   - Request an API key

2. **Configure in Vercel**
   - Add `OKOBAUDAT_API_KEY` to your environment variables
   - The API will automatically use authenticated requests

### Option 2: Without API Key (Limited)

- The application will work without an API key but with limitations:
  - Lower rate limits
  - Possible access restrictions
  - Fallback to sample data when limits are exceeded

### Fallback Mode

When the Ökobaudat API is unavailable or not configured, the application automatically:
- Uses sample material data for common materials
- Shows a notification about using fallback data
- Still allows material matching functionality

## Deployment Steps

1. **Push Code to Repository**
   ```bash
   git add .
   git commit -m "Add Ökobaudat integration"
   git push origin main
   ```

2. **Configure Vercel**
   - Go to your [Vercel Dashboard](https://vercel.com/dashboard)
   - Select your IfcLCA project
   - Navigate to Settings → Environment Variables
   - Add all required variables listed above

3. **Deploy**
   - Vercel will automatically deploy on push to main
   - Or manually trigger deployment from Vercel dashboard

4. **Verify Deployment**
   - Check deployment logs for any errors
   - Test the material library with Ökobaudat search
   - Verify API connectivity in browser console

## Troubleshooting

### "API Status: Connected" but no search results

**Cause**: API key not configured or invalid

**Solution**:
1. Verify `OKOBAUDAT_API_KEY` is set in Vercel environment variables
2. Check if the API key is valid
3. Review Vercel function logs for detailed error messages

### 401 Errors on Static Files

**Cause**: Middleware blocking public assets

**Solution**: Already fixed in the codebase - middleware now excludes static files

### 400 Bad Request Errors

**Cause**: Malformed API requests or missing parameters

**Solution**:
1. Check browser console for detailed error messages
2. Verify search query is at least 2 characters
3. Check Vercel function logs

### Timeout Errors

**Cause**: Ökobaudat API slow response

**Solution**:
- The application has a 30-second timeout
- Fallback data will be used if timeout occurs
- Consider implementing server-side caching

## Monitoring

### Vercel Functions Logs

View real-time logs:
1. Go to Vercel Dashboard → Functions tab
2. Select the API route (e.g., `api/okobaudat/search`)
3. View real-time logs and errors

### Application Logs

The application logs important events:
- API requests and responses
- Cache hits/misses
- Error details

## Performance Optimization

1. **Caching**: Results are cached for 24 hours by default
2. **Rate Limiting**: 100 requests/minute by default
3. **Fallback Data**: Sample data ensures functionality even without API

## Security Notes

- Never expose API keys in client-side code
- All Ökobaudat requests go through Next.js API routes
- API keys are only used server-side
- Use environment variables for all sensitive data

## Support

For issues specific to:
- **Ökobaudat API**: Contact [Ökobaudat support](https://www.oekobaudat.de/kontakt.html)
- **Vercel deployment**: Check [Vercel documentation](https://vercel.com/docs)
- **IfcLCA application**: Open an issue on GitHub







