/* DEBUT OR DIE public ballot client. Firestore Security Rules MUST be configured separately.
 * Never put admin credentials into this file. Do not report success until the write is confirmed.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VoteService=api;
})(globalThis,function(){
  'use strict';
  const PROJECT_ID='debut-or-die-vote';
  const GROUP_POLL_ID='pre-vote-group-v1';
  const SONGS=Object.freeze({
    'bloody-paradise':{title:'Bloody Paradise',artist:'ENHYPEN'},
    'shangri-la':{title:'Shangri-La／桃源境',artist:'VIXX'}
  });
  const MEMBERS=Object.freeze(Object.fromEntries(Array.from({length:7},(_,index)=>{
    const number=String(index+1).padStart(2,'0');
    return [`member-${number}`,{name:'角色名稱',coser:'COSER 的名字',label:`成員 ${number}・角色名稱（COSER 的名字）`}];
  })));
  const memberIds=Object.keys(MEMBERS);
  const makeError=(code,message)=>Object.assign(new Error(message||code),{code});
  const hex=()=>{const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');};
  function isValidGroupVote(v){return !!(v&&/^[a-f0-9]{32}$/.test(v.id)&&v.pollId===GROUP_POLL_ID&&v.assignments&&typeof v.assignments==='object'&&!Array.isArray(v.assignments)&&Object.keys(v.assignments).length===memberIds.length&&memberIds.every(id=>Object.hasOwn(SONGS,v.assignments[id])));}
  function newGroupVote(selections){const assignments=Object.fromEntries(memberIds.map(id=>[id,selections?.[id]]));const vote={id:hex(),pollId:GROUP_POLL_ID,assignments};if(!isValidGroupVote(vote))throw makeError('INVALID_SELECTION');return vote;}
  function errorMessage(error){return ({
    PERMISSION_DENIED:'資料庫目前拒絕寫入。請主辦方確認 groupVotes 的 Firestore Security Rules。',
    UNAUTHENTICATED:'投票服務要求登入，請聯絡主辦方確認設定。',
    NOT_FOUND:'找不到投票資料庫，請聯絡主辦方。',
    RESOURCE_EXHAUSTED:'目前投票人數較多，請稍後重試。',
    INVALID_ARGUMENT:'選票格式未被資料庫接受，請聯絡主辦方。',
    INVALID_SELECTION:'請先將七位成員完整分組。',
    CONFLICT:'資料庫中的這張選票與目前選擇不一致。請聯絡主辦方。',
    TIMEOUT:'連線逾時，尚未確認是否成功送達。',
    NETWORK:'暫時無法連上投票服務。',
    ALREADY_EXISTS:'這張選票編號已存在，正在重新確認。'
  })[error?.code]||'暫時無法確認選票。';}
  function createClient({fetchImpl=globalThis.fetch.bind(globalThis),timeoutMs=15000}={}){
    const db=`projects/${PROJECT_ID}/databases/(default)`;
    const endpoint=`https://firestore.googleapis.com/v1/${db}/documents`;
    async function request(url,options={}){
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const response=await fetchImpl(url,{...options,signal:controller.signal});
        const body=await response.json();
        if(!response.ok)throw makeError(body.error?.status||'SERVER_ERROR',body.error?.message);
        return body;
      }catch(error){
        if(controller.signal.aborted)throw makeError('TIMEOUT');
        if(error.code)throw error;
        throw makeError('NETWORK',error.message);
      }finally{clearTimeout(timer);}
    }
    function matchesGroup(doc,vote){
      const f=doc.fields||{};const fields=f.assignments?.mapValue?.fields||{};
      return f.pollId?.stringValue===vote.pollId&&memberIds.every(id=>fields[id]?.stringValue===vote.assignments[id])&&Object.keys(fields).length===memberIds.length;
    }
    async function confirmGroup(vote){const doc=await request(`${endpoint}/groupVotes/${vote.id}`);if(!matchesGroup(doc,vote))throw makeError('CONFLICT');return {confirmed:true,id:vote.id,time:doc.fields?.timestamp?.timestampValue||doc.createTime};}
    async function submitGroup(vote){
      if(!isValidGroupVote(vote))throw makeError('INVALID_SELECTION');
      const fields={pollId:{stringValue:vote.pollId},assignments:{mapValue:{fields:Object.fromEntries(memberIds.map(id=>[id,{stringValue:vote.assignments[id]}]))}}};
      try{
        const result=await request(`${endpoint}:commit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({writes:[{update:{name:`${db}/documents/groupVotes/${vote.id}`,fields},currentDocument:{exists:false},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}]}]})});
        if(!result.writeResults?.length||!result.commitTime)throw makeError('NETWORK');
        return {confirmed:true,id:vote.id,time:result.commitTime};
      }catch(error){
        // A lost acknowledgment must not create a second vote; confirm this exact document instead.
        if(['ALREADY_EXISTS','FAILED_PRECONDITION','PERMISSION_DENIED','NETWORK','TIMEOUT'].includes(error.code)){
          try{return await confirmGroup(vote);}catch(e){if(e.code==='CONFLICT')throw e;}
        }
        throw error;
      }
    }
    return {submitGroup};
  }
  return {MEMBERS,SONGS,newGroupVote,isValidGroupVote,errorMessage,createClient};
});
