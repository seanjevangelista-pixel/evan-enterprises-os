export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'Square not configured' });

  const { endpoint } = req.query;

  try {
    if (endpoint === 'locations') {
      const r = await fetch('https://connect.squareup.com/v2/locations', {
        headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-01-18' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (endpoint === 'payments') {
      const { begin_time, end_time, location_id } = req.query;
      const params = new URLSearchParams({ limit: '200' });
      if (begin_time)   params.set('begin_time', begin_time);
      if (end_time)     params.set('end_time', end_time);
      if (location_id)  params.set('location_id', location_id);

      const r = await fetch(`https://connect.squareup.com/v2/payments?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-01-18' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (endpoint === 'invoices') {
      const { location_id } = req.query;
      const params = new URLSearchParams({ limit: '200' });
      if (location_id) params.set('location_id', location_id);

      const r = await fetch(`https://connect.squareup.com/v2/invoices?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-01-18' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(400).json({ error: 'Unknown endpoint' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
