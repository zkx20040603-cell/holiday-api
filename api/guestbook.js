const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers}
});
const size = value => Array.from(value).length;
async function defaultClient(url, key) {
  const {createClient} = await import('@supabase/supabase-js');
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}});
}
export function createHandler({env = process.env, client = defaultClient} = {}) {
  return async function handle(request) {
    if (!['GET','POST'].includes(request.method)) return json(405, {code:'METHOD_NOT_ALLOWED',error:'GET 또는 POST만 가능합니다.'}, {Allow:'GET, POST'});
    let entry;
    if (request.method === 'POST') {
      if (!(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase().match(/^application\/json$/))
        return json(400,{code:'BAD_INPUT',error:'JSON 형식으로 보내 주세요.'});
      try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 4096) return json(400,{code:'BAD_INPUT',error:'입력 내용이 너무 깁니다.'});
        const body = JSON.parse(raw);
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['name','message'].includes(k)) || typeof body.name !== 'string' || typeof body.message !== 'string')
          return json(400,{code:'BAD_INPUT',error:'별명과 내용을 입력해 주세요.'});
        entry = {name:body.name.trim(),message:body.message.trim()};
        if (size(entry.name)<1 || size(entry.name)>20 || size(entry.message)<1 || size(entry.message)>200)
          return json(400,{code:'BAD_INPUT',error:'별명은 1~20자, 내용은 1~200자로 입력해 주세요.'});
      } catch { return json(400,{code:'BAD_INPUT',error:'올바른 JSON을 보내 주세요.'}); }
    }
    const key = request.method === 'GET' ? env.SUPABASE_PUBLISHABLE_KEY : env.SUPABASE_SECRET_KEY;
    if (!env.SUPABASE_URL || !key) return json(500,{code:'NO_KEY',error:'서버 환경 변수 설정이 필요합니다.'});
    try {
      const db = await client(env.SUPABASE_URL,key);
      if (request.method === 'GET') {
        const {data,error} = await db.from('guestbook').select('id,name,message,created_at').order('created_at',{ascending:false}).limit(20);
        if (error) return json(502,{code:'DB_ERROR',error:'방명록을 불러오지 못했습니다.'});
        return json(200,{entries:data || []});
      }
      const {error} = await db.from('guestbook').insert(entry);
      if (error) return json(502,{code:'DB_ERROR',error:'저장하지 못했습니다. 다시 시도해 주세요.'});
      return json(201,{ok:true});
    } catch { return json(502,{code:'DB_ERROR',error:'데이터베이스 연결을 확인해 주세요.'}); }
  };
}
export default {fetch:createHandler()};
