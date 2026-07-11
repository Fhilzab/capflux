// ==========================================================
// CAPSTONE SOFTWARE SOLUTIONS LTD
// Edge Function: send-notification
// Purpose: Route local notifications to provider (Termii SMS/WhatsApp or Email)
// ==========================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

interface NotificationPayload {
  id: string;
  school_id: string;
  student_id: string;
  recipient_phone: string;
  recipient_email?: string;
  message_body: string;
  delivery_method: 'SMS' | 'WHATSAPP' | 'EMAIL';
}

interface ProviderResponse {
  success: boolean;
  provider_msg_id?: string;
  error?: string;
}

// Termii API configuration
const TERMII_API_KEY = Deno.env.get('TERMII_API_KEY') || '';
const TERMII_SMS_URL = 'https://api.termii.com/api/sms/send';
const TERMII_WHATSAPP_URL = 'https://api.termii.com/api/whatsapp/send';

// Email configuration (SMTP or transactional email service)
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'noreply@capstone.school';
const EMAIL_API_KEY = Deno.env.get('EMAIL_API_KEY') || '';
const EMAIL_API_URL = Deno.env.get('EMAIL_API_URL') || '';

async function sendSMS(payload: NotificationPayload): Promise<ProviderResponse> {
  if (!TERMII_API_KEY) {
    console.warn('TERMII_API_KEY not configured');
    return { success: false, error: 'Termii API key not configured' };
  }

  try {
    const response = await fetch(TERMII_SMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TERMII_API_KEY,
        to: payload.recipient_phone,
        from: 'Capstone',
        sms: payload.message_body,
        type: 'plain',
        channel: 'generic',
      }),
    });

    const data = await response.json();
    if (data?.message_id) {
      return { success: true, provider_msg_id: data.message_id };
    }
    return { success: false, error: data?.message || 'SMS send failed' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendWhatsApp(payload: NotificationPayload): Promise<ProviderResponse> {
  if (!TERMII_API_KEY) {
    console.warn('TERMII_API_KEY not configured');
    return { success: false, error: 'Termii API key not configured' };
  }

  try {
    const response = await fetch(TERMII_WHATSAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TERMII_API_KEY,
        to: payload.recipient_phone,
        from: 'Capstone',
        message: payload.message_body,
        type: 'media',
      }),
    });

    const data = await response.json();
    if (data?.message_id) {
      return { success: true, provider_msg_id: data.message_id };
    }
    return { success: false, error: data?.message || 'WhatsApp send failed' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendEmail(payload: NotificationPayload): Promise<ProviderResponse> {
  if (!EMAIL_API_KEY || !EMAIL_API_URL) {
    console.warn('Email API not configured');
    return { success: false, error: 'Email API not configured' };
  }

  try {
    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: payload.recipient_email || payload.recipient_phone,
        subject: 'Capstone School Notification',
        text: payload.message_body,
        html: payload.message_body.replace(/\n/g, '<br/>'),
      }),
    });

    const data = await response.json();
    return { success: true, provider_msg_id: data?.id || `email-${Date.now()}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

serve(async (req) => {
  // CORS headers
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload: NotificationPayload = await req.json();

    if (!payload.recipient_phone && !payload.recipient_email) {
      return new Response(JSON.stringify({ error: 'recipient_phone or recipient_email required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (!payload.message_body) {
      return new Response(JSON.stringify({ error: 'message_body required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    let result: ProviderResponse;

    switch (payload.delivery_method) {
      case 'WHATSAPP':
        result = await sendWhatsApp(payload);
        break;
      case 'EMAIL':
        result = await sendEmail(payload);
        break;
      case 'SMS':
      default:
        result = await sendSMS(payload);
        break;
    }

    const statusCode = result.success ? 200 : 500;
    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});