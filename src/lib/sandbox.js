// Shared sandbox page builder for the Tutor workspace and the Lobby demo.

/*
 * Builds the sandboxed page. Every message carries the run id, so output from
 * an earlier run can never be mistaken for the current one. The user's script
 * starts on a known line, so runtime errors map back to script.js line numbers.
 * When `executeJs` is false (the build failed) the script is not included.
 */
export const buildDocument = (files, runId, { executeJs = true } = {}) => {
  const get = (lang) => files.find((f) => f.language === lang)?.code || '';
  const js = get('javascript').replace(/<\/script/gi, '<\\/script');
  const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${get('css')}</style></head><body>${get('html')}
<script>(function(){
  var RUN=${runId};
  var fmt=function(a){try{if(typeof a==='string')return a;if(typeof a==='function')return 'ƒ '+(a.name||'anonymous')+'()';if(a instanceof Error)return a.name+': '+a.message;if(a instanceof Element)return '<'+a.tagName.toLowerCase()+(a.id?'#'+a.id:'')+'>';var s=JSON.stringify(a);return s===undefined?String(a):s}catch(e){return String(a)}};
  var send=function(type,args,extra){try{var m={__monklogy:true,run:RUN,type:type,text:Array.prototype.map.call(args,fmt).join(' ')};for(var k in extra)m[k]=extra[k];parent.postMessage(m,'*')}catch(e){}};
  ['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){send(k,arguments);o.apply(console,arguments)}});
  window.addEventListener('error',function(e){var msg=String(e.message||'Error').replace('Uncaught ','');send('runtime',[msg],{lineno:e.lineno,colno:e.colno})});
  window.addEventListener('unhandledrejection',function(e){var r=e.reason;send('runtime',['Unhandled promise rejection: '+(r&&r.name?r.name+': '+r.message:fmt(r))])});
  window.addEventListener('message',function(e){var d=e.data;if(!d||!d.__monklogyEval)return;try{var r=(0,eval)(d.code);if(r&&typeof r.then==='function'){send('result',['Promise {<pending>}'],{id:d.id});r.then(function(v){send('result',['Promise resolved: '+fmt(v)],{id:d.id})},function(err){send('runtime',['Promise rejected: '+fmt(err)],{id:d.id})})}else send('result',[r===undefined?'undefined':typeof r==='string'?JSON.stringify(r):fmt(r)],{id:d.id})}catch(err){send('evalerror',[err.name+': '+err.message],{id:d.id})}});
})();<\/script>
<script>`;
  const jsStartLine = head.split('\n').length;
  const tail = `<\/script>
<script>parent.postMessage({__monklogy:true,run:${runId},type:'done'},'*')<\/script></body></html>`;
  // A failed build gets no "done" signal: nothing ran, so nothing can report success.
  return { html: executeJs ? head + js + tail : `${head}/* build failed — script not executed */<\/script></body></html>`, jsStartLine };
};

