/* User-supplied YouTube performances and chorus cues, in seconds. */
(()=>{
  'use strict';
  const clips={
    bloody:{id:'Pr-4Nze0OyQ',start:51,title:'Bloody Paradise'},
    shangri:{id:'jou9CPd7Cnw',start:50,title:'Shangri-La 桃源境'}
  };
  const listen=document.getElementById('listen');
  if(!listen)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const films=[...listen.querySelectorAll('.stage-film')],players=new Map(),blocked=new Set();
  let youtubePromise,requestedVideo=null;
  const pause=except=>{if(!except)requestedVideo=null;players.forEach((entry,key)=>{if(key!==except&&entry.ready)entry.player.pauseVideo();});};
  function youtubeAPI(){
    if(window.YT?.Player)return Promise.resolve();
    if(youtubePromise)return youtubePromise;
    youtubePromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      const timer=setTimeout(()=>reject(new Error('TIMEOUT')),12000);
      window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);previous?.();resolve();};
      const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
      script.onerror=()=>{clearTimeout(timer);reject(new Error('NETWORK'));};document.head.append(script);
    }).catch(error=>{youtubePromise=null;throw error;});
    return youtubePromise;
  }
  films.forEach(film=>{
    const key=film.dataset.video,clip=clips[key],button=film.querySelector('.film-play'),status=film.querySelector('.film-status'),replay=film.querySelector('.film-replay');
    film.querySelector('.film-thumbnail')?.addEventListener('error',event=>{event.currentTarget.hidden=true;});
    const external=film.querySelector('.film-meta a');
    external.href='https://www.youtube.com/watch?v='+clip.id+'&t='+clip.start+'s';
    const fail=message=>{film.classList.remove('video-active');button.disabled=false;status.textContent=message;};
    async function play(){
      if(blocked.has(key))return;
      if(film.closest('.track-story').hidden)return;
      if(location.protocol==='file:'){status.textContent='請以「開啟網頁預覽.cmd」開啟本機網頁，或使用 YouTube 連結觀看舞台。';return;}
      requestedVideo=key;pause(key);document.dispatchEvent(new Event('stage-preview-play'));
      button.disabled=true;status.textContent='正在連接舞台…';
      try{
        await youtubeAPI();
        if(listen.hidden||film.closest('.track-story').hidden||requestedVideo!==key){button.disabled=false;status.textContent='';return;}
        const current=players.get(key);
        if(current?.ready){current.player.loadVideoById({videoId:clip.id,startSeconds:clip.start,endSeconds:clip.start+30});film.classList.add('video-active');button.disabled=false;status.textContent='';replay.hidden=true;return;}
        if(current){button.disabled=false;return;}
        const entry={ready:false,player:null,timer:0,loadTimer:0};players.set(key,entry);
        entry.loadTimer=setTimeout(()=>{if(!entry.ready){fail('舞台播放器未回應，請使用 YouTube 連結觀看。');players.delete(key);entry.player?.destroy();}},15000);
        if(!document.getElementById('youtube-'+key)){
          const mount=document.createElement('div');mount.id='youtube-'+key;mount.className='youtube-slot';film.querySelector('.film-screen').prepend(mount);
        }
        entry.player=new YT.Player('youtube-'+key,{
          width:'100%',height:'100%',videoId:clip.id,
          playerVars:{playsinline:1,controls:1,rel:0,start:clip.start,end:clip.start+30,origin:location.origin},
          events:{
            onReady:event=>{
              clearTimeout(entry.loadTimer);entry.ready=true;const iframe=event.target.getIframe();iframe.title=clip.title+' 副歌舞台影片';iframe.referrerPolicy='strict-origin-when-cross-origin';
              iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
              if(listen.hidden||film.closest('.track-story').hidden||requestedVideo!==key){event.target.pauseVideo();button.disabled=false;status.textContent='';return;}
              event.target.setVolume(100);event.target.loadVideoById({videoId:clip.id,startSeconds:clip.start,endSeconds:clip.start+30});
              film.classList.add('video-active');button.disabled=false;status.textContent='';replay.hidden=true;
            },
            onStateChange:event=>{
              clearInterval(entry.timer);
              if(event.data===YT.PlayerState.PLAYING){
                if(listen.hidden||film.closest('.track-story').hidden||document.hidden){event.target.pauseVideo();return;}
                pause(key);document.dispatchEvent(new Event('stage-preview-play'));replay.hidden=true;
                entry.timer=setInterval(()=>{if(event.target.getCurrentTime()>=clip.start+30){event.target.pauseVideo();clearInterval(entry.timer);replay.hidden=false;status.textContent='30 秒舞台片段播放完畢。';}},200);
              }
              if(event.data===YT.PlayerState.ENDED){replay.hidden=false;status.textContent='30 秒舞台片段播放完畢。';}
            },
            onError:event=>{
              clearInterval(entry.timer);clearTimeout(entry.loadTimer);
              fail([101,150].includes(event.data)?'此影片限制嵌入，請使用 YouTube 連結觀看。':event.data===153?'播放器需要網頁來源，請使用本機預覽啟動器或 YouTube 連結。':'舞台影片暫時無法載入，請使用 YouTube 連結觀看。');
              if([101,150].includes(event.data)){
                blocked.add(key);button.hidden=true;
                const link=document.createElement('a');link.className='film-play film-external';link.href=external.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='前往 YouTube 觀看 ↗';film.querySelector('.film-poster').append(link);
              }
            }
          }
        });
      }catch{fail('舞台影片連線未完成，請再試一次或使用 YouTube 連結。');}
    }
    button.addEventListener('click',play);replay.addEventListener('click',play);
  });
  const stories=[...listen.querySelectorAll('.track-story')];
  const deck=document.getElementById('track-deck'),nextStep=document.getElementById('next-step');
  let activeIndex=0,switching=false;
  function paintNavigation(){
    listen.querySelectorAll('.listening-nav button').forEach(button=>{
      button.setAttribute('aria-current',String(button.dataset.scrollTrack===stories[activeIndex].id));
      button.disabled=switching;
    });
    nextStep.hidden=activeIndex!==stories.length-1||switching;
  }
  stories.forEach((story,index)=>{story.hidden=index!==activeIndex;});
  paintNavigation();
  function pauseAll(){pause();listen.querySelectorAll('audio').forEach(audio=>audio.pause());}
  async function switchTrack(id){
    const index=stories.findIndex(story=>story.id===id);
    if(switching||index<0||index===activeIndex)return;
    switching=true;pauseAll();paintNavigation();deck.setAttribute('aria-busy','true');
    const old=stories[activeIndex],incoming=stories[index],animations=[];
    try{
      if(!reduced){
        deck.style.height=deck.offsetHeight+'px';old.inert=true;
        const outgoing=old.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-55%)',opacity:0,filter:'blur(5px)'}],{duration:560,easing:'cubic-bezier(.6,0,.4,1)',fill:'forwards'});
        animations.push(outgoing);deck.classList.add('is-switching');
        await outgoing.finished;
      }
      old.hidden=true;incoming.hidden=false;activeIndex=index;
      if(!reduced){
        incoming.classList.add('scene-arriving');
        const entering=incoming.animate([{transform:'translateY(65%)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:820,easing:'cubic-bezier(.16,.8,.2,1)',fill:'both'});
        animations.push(entering);await entering.finished;
      }
      document.getElementById('deck-announcement').textContent=clips[incoming.dataset.track].title+'，舞台已就緒。';
      const title=incoming.querySelector('h3');title.tabIndex=-1;title.focus({preventScroll:true});
    }finally{
      stories.forEach((story,i)=>{story.hidden=i!==activeIndex;story.inert=false;});
      animations.forEach(animation=>animation.cancel());deck.style.height='';deck.classList.remove('is-switching');deck.removeAttribute('aria-busy');
      setTimeout(()=>incoming.classList.remove('scene-arriving'),600);
      switching=false;paintNavigation();
    }
  }
  if('IntersectionObserver'in window){
    const filmObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting){const current=players.get(entry.target.dataset.video);if(current?.ready)current.player.pauseVideo();}}),{threshold:0});
    films.forEach(film=>filmObserver.observe(film));
  }
  const refresh=()=>paintNavigation();
  listen.querySelectorAll('[data-scroll-track]').forEach(button=>button.addEventListener('click',()=>switchTrack(button.dataset.scrollTrack)));
  addEventListener('pagehide',()=>pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.StageListening=Object.freeze({pause,refresh});refresh();
})();
