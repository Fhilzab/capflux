import express from 'express';
import cors from 'cors';
import { supabase, hasSupabaseConfig } from './supabaseClient.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', hasSupabaseConfig });
});

app.post('/rpc', async (req, res) => {
  if (!hasSupabaseConfig) {
    return res.status(500).json({ error: 'Supabase backend is not configured.' });
  }

  const { functionName, params } = req.body;
  if (!functionName) {
    return res.status(400).json({ error: 'functionName is required.' });
  }

  const { data, error } = await supabase.rpc(functionName, params || {});
  if (error) {
    return res.status(500).json({ error: error.message, details: error.details });
  }

  return res.json({ data });
});

app.listen(port, () => {
  console.log(`Capstone backend server running on http://localhost:${port}`);
});
