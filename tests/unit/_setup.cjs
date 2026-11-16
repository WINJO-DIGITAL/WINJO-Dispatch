'use strict';
// Preloaded by `npm run test:unit` (node --require): the tests behave as a dedicated deployment of
// one sample business. The shared platform has no built-in business, so a test that needs one says so.
process.env.TENANT_ID = process.env.TENANT_ID || 'a0000000-0000-4000-8000-000000000001';
process.env.STRIPE_PLATFORM_TENANT_ID = process.env.STRIPE_PLATFORM_TENANT_ID || 'a0000000-0000-4000-8000-000000000001';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test-project.supabase.co';
