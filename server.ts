import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
  throw new Error('Configure SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.');
}

// A chave service role fica somente no servidor; o navegador usa a API Express.
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '10mb' }));

app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName, role, subject } = req.body;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName, role, subject },
  });
  if (authError || !authData.user) return res.status(authError?.status === 422 ? 400 : 500).json({ error: authError?.status === 422 ? 'Email já cadastrado' : 'Erro ao registrar' });

  const uid = authData.user.id;
  const { data, error } = await supabase
    .from('users')
    .insert({ uid, email, displayName, role, subject })
    .select('uid,email,displayName,role,subject')
    .single();

  if (error) {
    await supabase.auth.admin.deleteUser(uid);
    return res.status(500).json({ error: 'Erro ao registrar perfil' });
  }
  res.json(data);
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) return res.status(401).json({ error: 'Credenciais inválidas' });
  const { data, error } = await supabase.from('users').select('*').eq('uid', authData.user.id).maybeSingle();
  if (error) return res.status(500).json({ error: 'Erro ao realizar login' });
  if (!data) return res.status(401).json({ error: 'Credenciais inválidas' });
  res.json(data);
});

app.get('/api/schedules', async (req, res) => {
  let query = supabase.from('schedules').select('*').order('date', { ascending: false }).order('startTime', { ascending: true });
  if (req.query.teacherId) query = query.eq('teacherId', req.query.teacherId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Erro ao buscar horários' });
  res.json(data);
});

app.post('/api/schedules', async (req, res) => {
  const { date, startTime, endTime, subject, room, teacherId, teacherName, classGroup } = req.body;
  const { data, error } = await supabase.from('schedules').insert({ date, startTime, endTime, subject, room, teacherId, teacherName, classGroup, status: 'pending' }).select('id').single();
  if (error) return res.status(500).json({ error: 'Erro ao criar horário' });
  res.json({ id: data.id, status: 'success' });
});

app.patch('/api/schedules/:id', async (req, res) => {
  const { status, date, startTime, endTime, subject, room, teacherId, teacherName, classGroup } = req.body;
  const onlyStatus = status !== undefined && date === undefined && startTime === undefined && endTime === undefined && subject === undefined && room === undefined && teacherId === undefined;
  const updates = onlyStatus
    ? { status, updatedAt: new Date().toISOString() }
    : { status, date, startTime, endTime, subject, room, teacherId, teacherName, classGroup, updatedAt: new Date().toISOString() };
  const { error } = await supabase.from('schedules').update(updates).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Erro ao atualizar horário' });
  res.json({ status: 'success' });
});

app.delete('/api/schedules/:id', async (req, res) => {
  const { error } = await supabase.from('schedules').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Erro ao excluir horário' });
  res.json({ status: 'success' });
});

app.get('/api/stats', async (_req, res) => {
  const { data, error } = await supabase.from('schedules').select('status');
  if (error) return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  res.json({ total: data.length, confirmed: data.filter(item => item.status === 'confirmed').length, absent: data.filter(item => item.status === 'absent').length, pending: data.filter(item => item.status === 'pending').length });
});

app.get('/api/teachers', async (_req, res) => {
  const { data, error } = await supabase.from('users').select('*').eq('role', 'teacher');
  if (error) return res.status(500).json({ error: 'Erro ao buscar professores' });
  res.json(data);
});

app.get('/api/labs/bookings', async (_req, res) => {
  const { data, error } = await supabase.from('lab_bookings').select('*').order('date', { ascending: false }).order('startTime', { ascending: true });
  if (error) return res.status(500).json({ error: 'Erro ao buscar reservas' });
  res.json(data);
});

app.post('/api/labs/bookings', async (req, res) => {
  const { error } = await supabase.from('lab_bookings').insert(req.body);
  if (error) return res.status(500).json({ error: 'Erro ao criar reserva' });
  res.json({ status: 'success' });
});

app.delete('/api/labs/bookings/:id', async (req, res) => {
  const { error } = await supabase.from('lab_bookings').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Erro ao excluir reserva' });
  res.json({ status: 'success' });
});

app.delete('/api/labs/bookings-clear-all', async (_req, res) => {
  const { error } = await supabase.from('lab_bookings').delete().not('id', 'is', null);
  if (error) return res.status(500).json({ error: 'Erro ao limpar reservas' });
  res.json({ status: 'success' });
});

app.get('/api/certificates', async (_req, res) => {
  const { data, error } = await supabase.from('certificates').select('*').order('createdAt', { ascending: false });
  if (error) return res.status(500).json({ error: 'Erro ao buscar certificados' });
  res.json(data);
});

app.post('/api/certificates', async (req, res) => {
  const { error } = await supabase.from('certificates').insert(req.body);
  if (error) return res.status(500).json({ error: 'Erro ao criar certificado' });
  res.json({ status: 'success' });
});

app.patch('/api/certificates/:id/approve', async (req, res) => {
  const { data: certificate, error: findError } = await supabase.from('certificates').select('teacherId,date').eq('id', req.params.id).maybeSingle();
  if (findError) return res.status(500).json({ error: 'Erro ao buscar certificado' });
  if (!certificate) return res.status(404).json({ error: 'Certificado não encontrado' });
  const { error } = await supabase.from('certificates').update({ status: 'approved' }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Erro ao aprovar certificado' });
  await supabase.from('schedules').update({ status: 'vaga' }).eq('teacherId', certificate.teacherId).eq('date', certificate.date);
  res.json({ status: 'success' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running at http://localhost:${PORT}`));
}

startServer();
export default app;
