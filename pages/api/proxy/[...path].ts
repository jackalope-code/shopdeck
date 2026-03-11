import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  const path = (req.query.path as string[])?.join('/') || '';
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const targetUrl = `${apiUrl}/api/${path}`;

  const headers: Record<string, string> = {};
  Object.keys(req.headers).forEach((key) => {
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
      const value = req.headers[key];
      if (value) headers[key] = Array.isArray(value) ? value[0] : value;
    }
  });

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    const buffer = await getRawBody(req);
    fetchOptions.body = buffer as unknown as BodyInit;
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
    
    const contentType = response.headers.get('content-type');
    const responseData = await response.text();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (contentType?.includes('application/json')) {
      return res.status(response.status).json(JSON.parse(responseData));
    } else {
      return res.status(response.status).send(responseData);
    }
  } catch (error) {
    return res.status(502).json({ error: 'Proxy error', message: String(error) });
  }
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
