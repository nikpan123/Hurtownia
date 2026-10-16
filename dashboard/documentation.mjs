const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// README is rendered as text and a small allowlist of Markdown, never raw HTML.
export function renderDocumentation(markdown){
  const toc=[],lines=markdown.replace(/\r/g,'').split('\n');let html='',list='',fenced=false,code=[];
  const anchors=new Map();let headingIndex=0,inCode=false;
  for(const line of lines){if(/^\s*```/.test(line)){inCode=!inCode;continue;}const h=!inCode&&line.match(/^#{1,6}\s+(.+)$/);if(h)anchors.set(h[1].toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu,'').replace(/\s/g,'-'),'doc-'+headingIndex++);}
  const inline=text=>{
    const tokens=[];
    const protectedText=text.replace(/`([^`]+)`/g,(_,value)=>{tokens.push('<code>'+escape(value)+'</code>');return '\u0000'+(tokens.length-1)+'\u0000';});
    return escape(protectedText).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[\p{L}\p{N}_-]+)\)/gu,(_,label,url)=>url.startsWith('#')?(anchors.has(url.slice(1))?'<a href="#'+anchors.get(url.slice(1))+'" data-doc-heading="'+anchors.get(url.slice(1))+'">'+label+'</a>':label):'<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+label+'</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\u0000(\d+)\u0000/g,(_,n)=>tokens[Number(n)]);
  };
  const closeList=()=>{if(list){html+='</'+list+'>';list='';}};
  const cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(v=>v.trim());
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/^\s*```/.test(line)){closeList();if(fenced){html+='<pre><code>'+escape(code.join('\n'))+'</code></pre>';code=[];}fenced=!fenced;continue;}
    if(fenced){code.push(line);continue;}
    if(!line.trim()){closeList();continue;}
    const heading=line.match(/^(#{1,6})\s+(.+)$/);
    if(heading){closeList();const level=heading[1].length,id='doc-'+toc.length;toc.push({id,level,title:heading[2]});html+=`<h${level} id="${id}">${inline(heading[2])}</h${level}>`;continue;}
    if(line.trim().startsWith('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]??'')){
      closeList();html+='<div class="table-scroll"><table><thead><tr>'+cells(line).map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';i++;
      while(lines[i+1]?.trim().startsWith('|'))html+='<tr>'+cells(lines[++i]).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>';
      html+='</tbody></table></div>';continue;
    }
    const item=line.match(/^\s*(?:([-*])|\d+\.)\s+(.+)$/);
    if(item){const tag=item[1]?'ul':'ol';if(list!==tag){closeList();html+='<'+tag+'>';list=tag;}html+='<li>'+inline(item[2])+'</li>';continue;}
    closeList();html+='<p>'+inline(line)+'</p>';
  }
  closeList();if(fenced)html+='<pre><code>'+escape(code.join('\n'))+'</code></pre>';
  return {html,toc};
}
