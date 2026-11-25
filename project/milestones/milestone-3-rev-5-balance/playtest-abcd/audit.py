import json,sys,collections
ok={'ToolSearch','Write','SubagentHandback'}|{'mcp__playwright__browser_'+x for x in('snapshot','find','click','select_option','type','press_key','hover','take_screenshot')}
c=collections.Counter();bad=[];usage=collections.Counter();writes=[];model=set();mx=0
for line in open(sys.argv[1]):
    try:r=json.loads(line)
    except Exception: continue
    m=r.get('message',{})
    if not isinstance(m,dict): continue
    if m.get('model'): model.add(m['model'])
    u=m.get('usage')
    if u:
        key=m.get('id')
        usage[key]=(u.get('input_tokens',0)+u.get('cache_creation_input_tokens',0),u.get('cache_read_input_tokens',0),u.get('output_tokens',0))
        mx=max(mx,u.get('input_tokens',0)+u.get('cache_creation_input_tokens',0)+u.get('cache_read_input_tokens',0))
    for b in m.get('content',[]) if isinstance(m.get('content'),list) else []:
        if b.get('type')=='tool_use':
            c[b['name']]+=1
            if b['name'] not in ok: bad.append((b['name'],json.dumps(b['input'])[:200]))
            if b['name']=='Write': writes.append(b['input'].get('file_path'))
            if b['name']=='ToolSearch': print('ToolSearch:',json.dumps(b['input'])[:260])
            if b['name'].endswith('snapshot') and b['input'].get('filename'): bad.append((b['name'],json.dumps(b['input'])))
print('model',model); print(dict(c)); print('NOT ALLOWED:',bad or 'none'); print('writes',writes)
print('uncached in',sum(x[0] for x in usage.values()),'cache read',sum(x[1] for x in usage.values()),'out',sum(x[2] for x in usage.values()),'largest context',mx,'requests',len(usage))
