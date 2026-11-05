import React, { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Img, Sequence, continueRender, delayRender, cancelRender, interpolate, Easing, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import rawWords from "../public/words.json";

const C={paper:"#F7F7F0",ink:"#141B19",lime:"#B7F36B",green:"#17653A",muted:"#60695F",soft:"#E8EDDE",white:"#FFFFFF"};
const ease=Easing.bezier(.22,1,.36,1);
const lerp=(f:number,a:number,b:number,x:number,y:number)=>interpolate(f,[a,b],[x,y],{easing:ease,extrapolateLeft:"clamp",extrapolateRight:"clamp"});
const stage:CSSProperties={fontFamily:"Geist",fontWeight:500,color:C.ink,background:C.paper};
const scenes=[0,758,1140,1708,2100,2544,2834,3452,4449,4797,5400];

function FontReady({children}:{children:ReactNode}){
  const [handle]=useState(()=>delayRender("Loading POT brand font"));
  useEffect(()=>{const face=new FontFace("Geist",`url(${staticFile("geist-medium.ttf")})`,{weight:"500"});face.load().then(font=>{(document.fonts as FontFaceSet & {add: (face: FontFace) => void}).add(font);continueRender(handle)}).catch(cancelRender)},[handle]);
  return <>{children}</>;
}
function Logo({white=false,width=180}:{white?:boolean;width?:number}){
  return <Img src={staticFile("pot-logo.svg")} style={{width,height:width/3,filter:white?"invert(1)":"none"}} />;
}
function Arrow({size=34,color=C.ink}:{size?:number;color?:string}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M5 19 19 5M5 5h14v14" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
function Header({dark=false,chapter="Product introduction"}:{dark?:boolean;chapter?:string}){
  return <div style={{position:"absolute",left:96,right:96,top:56,display:"flex",justifyContent:"space-between",alignItems:"center",color:dark?C.paper:C.muted}}><Logo white={dark} width={152}/><div style={{fontSize:22,letterSpacing:.1}}>{chapter}</div></div>;
}
function Enter({children,delay=0,style={}}:{children:ReactNode;delay?:number;style?:CSSProperties}){
  const f=useCurrentFrame();const p=lerp(f,delay,delay+40,0,1);
  return <div style={{opacity:p,transform:`translateY(${(1-p)*36}px)`,...style}}>{children}</div>;
}
function Title({children,dark=false,size=92,style={}}:{children:ReactNode;dark?:boolean;size?:number;style?:CSSProperties}){
  return <h1 style={{fontSize:size,letterSpacing:-size*.055,lineHeight:1.03,fontWeight:500,margin:0,color:dark?C.paper:C.ink,...style}}>{children}</h1>;
}
function Body({children,dark=false,style={}}:{children:ReactNode;dark?:boolean;style?:CSSProperties}){
  return <p style={{fontSize:30,lineHeight:1.42,color:dark?"#B9C4B5":C.muted,margin:"28px 0 0",maxWidth:620,...style}}>{children}</p>;
}
function Screen({file,width=530,style={}}:{file:string;width?:number;style?:CSSProperties}){
  return <div style={{width,borderRadius:20,overflow:"hidden",background:C.white,boxShadow:"0 14px 32px rgba(20,27,25,.08)",...style}}><Img src={staticFile(`screens/${file}`)} style={{width:"100%",display:"block"}}/></div>;
}
function Tag({children,dark=false}:{children:ReactNode;dark?:boolean}){return <div style={{display:"inline-flex",alignSelf:"flex-start",padding:"10px 16px",borderRadius:8,background:dark?"#29392A":C.soft,color:dark?C.lime:C.green,fontSize:22,marginBottom:24}}>{children}</div>}
function Pool({size=200,color=C.ink}:{size?:number;color?:string}){
 return <svg width={size} height={size} viewBox="0 0 40 40" fill="none"><g fill={color}><circle cx="12" cy="10" r="3"/><circle cx="20" cy="6" r="3"/><circle cx="28" cy="10" r="3"/></g><path d="M6 19h28l-2 9a12.3 12.3 0 0 1-24 0l-2-9Z" stroke={color} strokeWidth="3" strokeLinejoin="round"/></svg>
}

function Problem(){const f=useCurrentFrame();return <AbsoluteFill style={stage}><Header/>
  <Enter delay={8} style={{position:"absolute",left:96,top:245,width:900}}><Tag>For the plans you make together</Tag><Title size={104}>Great plans.<br/><span style={{color:C.green}}>Awkward money chats.</span></Title><Body>There’s always someone left<br/>organising the money.</Body></Enter>
  <div style={{position:"absolute",left:1170,top:245,width:590}}>{["The weekend away.","The birthday surprise.","That good idea."].map((t,i)=><Enter delay={80+i*75} key={t} style={{marginBottom:22,transform:`translateX(${i%2?25:0}px)`,padding:"32px 36px",borderRadius:22,background:i===1?C.lime:C.white,fontSize:36,boxShadow:"0 4px 16px rgba(20,27,25,.04)"}}>{t}</Enter>)}</div>
  <div style={{position:"absolute",left:96,bottom:170,fontSize:22,color:C.muted,opacity:lerp(f,450,490,0,1)}}>One shared goal deserves one clear money plan.</div>
 </AbsoluteFill>}
function Introduce(){return <AbsoluteFill style={{...stage,background:C.ink}}><Header dark chapter="Meet POT"/>
  <Enter style={{position:"absolute",left:96,top:300}}><Title dark size={122}>Big plans.<br/>One shared <span style={{color:C.lime}}>pot.</span></Title><Body dark>Good things, pooled.</Body></Enter>
  <Enter delay={18} style={{position:"absolute",left:1280,top:230,width:440,height:440,borderRadius:60,background:C.lime,display:"flex",alignItems:"center",justifyContent:"center"}}><Pool size={300}/></Enter>
 </AbsoluteFill>}
function Plan(){const f=useCurrentFrame();return <AbsoluteFill style={stage}><Header chapter="Start with a clear plan"/>
  <Enter style={{position:"absolute",left:96,top:275,width:650}}><Tag>01 · Create</Tag><Title size={88}>Your idea.<br/>Your goal.<br/><span style={{color:C.green}}>Your rules.</span></Title><Body>Name it. Set the deadline.<br/>Make the terms clear.</Body></Enter>
  <Enter delay={16} style={{position:"absolute",left:1100,top:150}}><Screen file={f<270?"plan-fields.png":"plan-summary.png"} width={520} style={{maxHeight:800}}/></Enter>
  <Enter delay={280} style={{position:"absolute",left:96,bottom:180,padding:"20px 28px",borderRadius:12,background:C.lime,fontSize:28}}>One clear plan to share <span style={{display:"inline-flex",verticalAlign:"middle",marginLeft:18}}><Arrow size={26}/></span></Enter>
 </AbsoluteFill>}
function Contribute(){const f=useCurrentFrame();const t=lerp(f,65,210,0,1);return <AbsoluteFill style={stage}><Header chapter="02 · Contribute"/>
  <Enter style={{position:"absolute",left:96,top:200}}><Title size={88}>USDC in.<br/><span style={{color:C.green}}>Clarity throughout.</span></Title><Body>Funding progress follows<br/>confirmed transactions on Base.</Body></Enter>
  <div style={{position:"absolute",left:920,top:280,width:880,height:470}}>
   <svg width="880" height="470" style={{position:"absolute"}}><path d="M90 90 400 235M90 235h310M90 380l310-145" stroke="#CBD6BE" strokeWidth="4"/><path d="M400 235h340" stroke={C.green} strokeWidth="4" strokeDasharray="12 12"/>{[90,235,380].map((y,i)=><circle key={y} cx={90+310*((t+i*.26)%1)} cy={y+(235-y)*((t+i*.26)%1)} r="10" fill={C.green}/>)}</svg>
   {[90,235,380].map((y,i)=><Enter key={i} delay={30+i*12} style={{position:"absolute",left:28,top:y-42,width:84,height:84,borderRadius:42,background:C.white,display:"grid",placeItems:"center",border:"1px solid #D9DFD0",fontSize:25}}>USDC</Enter>)}
   <Enter delay={20} style={{position:"absolute",left:315,top:150,width:170,height:170,borderRadius:34,background:C.lime,display:"grid",placeItems:"center"}}><Pool size={120}/></Enter>
   <Enter delay={90} style={{position:"absolute",left:620,top:155,width:220,padding:24,borderRadius:18,background:C.white}}><div style={{color:C.green,fontSize:28,marginBottom:12}}>Confirmed</div><div style={{fontSize:24,lineHeight:1.4,color:C.muted}}>Only confirmed contributions count.</div></Enter>
  </div>
 </AbsoluteFill>}
function Settlement(){return <AbsoluteFill style={{...stage,background:C.ink}}><Header dark chapter="03 · Settle by the rules"/>
  <Enter style={{position:"absolute",left:96,top:215}}><Title dark size={84}>Rules before<br/><span style={{color:C.lime}}>money moves.</span></Title><Body dark>Everyone knows what happens<br/>when the deadline arrives.</Body></Enter>
  <div style={{position:"absolute",left:1000,top:235,width:760}}>
    {[{a:"Goal reached",b:"Organizer can withdraw",color:C.lime},{a:"Goal missed after deadline",b:"Contributors can claim refunds",color:C.paper}].map((rule,i)=><Enter key={rule.a} delay={30+i*65} style={{padding:32,borderRadius:20,background:rule.color,marginBottom:28}}><div style={{fontSize:26,color:C.green,marginBottom:16}}>{rule.a}</div><div style={{fontSize:35,lineHeight:1.2,letterSpacing:-1}}>{rule.b}</div></Enter>)}
    <Enter delay={90} style={{fontSize:24,color:"#B9C4B5",paddingTop:12}}>Refunds must be claimed. They are not automatic.</Enter>
  </div>
 </AbsoluteFill>}
function Crowdfunding(){return <AbsoluteFill style={stage}><Header chapter="Different plans. Clear rules."/>
  <Enter style={{position:"absolute",left:96,top:220}}><Title size={82}>Raising for<br/><span style={{color:C.green}}>something bigger?</span></Title><Body>Name the payout wallet.<br/>Choose when it can withdraw.</Body></Enter>
  <div style={{position:"absolute",left:1000,top:230,width:760}}>{[{a:"At the deadline",b:"The named wallet withdraws after contributions close."},{a:"As funds come in",b:"The named wallet can withdraw while contributions remain open."}].map((v,i)=><Enter key={v.a} delay={20+i*20} style={{background:C.white,padding:32,marginBottom:24,borderRadius:20}}><div style={{fontSize:34,letterSpacing:-1,marginBottom:12}}>{v.a}</div><div style={{fontSize:25,lineHeight:1.4,color:C.muted}}>{v.b}</div></Enter>)}<div style={{fontSize:24,color:C.green}}>Crowdfunding rules do not include contributor refunds.</div></div>
 </AbsoluteFill>}
function Future(){const f=useCurrentFrame();return <AbsoluteFill style={stage}><Header chapter="Future vision"/>
  <Enter style={{position:"absolute",left:96,top:240}}><Tag>What this could become</Tag><Title size={96}>From a pot<br/><span style={{color:C.green}}>to a platform.</span></Title><Body>A shared payments layer<br/>for people, communities, and apps.</Body></Enter>
  <div style={{position:"absolute",left:990,top:225,width:780,height:530}}>
   <svg width="780" height="530" style={{position:"absolute"}}><path d="M390 270 140 70M390 270 650 70M390 270 140 450M390 270 650 450" stroke="#C8D5BA" strokeWidth="4" strokeDasharray={`${lerp(f,30,95,0,700)} 1400`}/></svg>
   {[{x:0,y:0,t:"Creator communities"},{x:490,y:0,t:"Event organizers"},{x:0,y:390,t:"Community causes"},{x:490,y:390,t:"Other apps"}].map((n,i)=><Enter key={n.t} delay={35+i*20} style={{position:"absolute",left:n.x,top:n.y,width:290,padding:"26px 20px",textAlign:"center",fontSize:25,background:C.white,borderRadius:14}}>{n.t}</Enter>)}
   <Enter delay={10} style={{position:"absolute",left:280,top:155,width:220,height:220,borderRadius:42,background:C.lime,display:"grid",placeItems:"center"}}><Pool size={156}/></Enter>
  </div>
 </AbsoluteFill>}
function Token(){return <AbsoluteFill style={{...stage,background:C.ink}}><Header dark chapter="POT token · Proposed concept"/>
  <Enter style={{position:"absolute",left:96,top:205}}><Tag dark>A network its community can shape</Tag><Title dark size={92}>Shared value.<br/><span style={{color:C.lime}}>Shared direction.</span></Title></Enter>
  <div style={{position:"absolute",left:96,right:96,top:535,display:"flex",gap:28}}>{[{n:"01",t:"Allocate grants",b:"Fund useful ecosystem work."},{n:"02",t:"Sponsor fees",b:"Make participation easier."},{n:"03",t:"Reward builders",b:"Recognize real contributions."}].map((v,i)=><Enter key={v.t} delay={45+i*55} style={{flex:1,padding:36,border:"1px solid #394638",borderRadius:20,color:C.paper}}><div style={{fontSize:24,color:C.lime,marginBottom:36}}>{v.n}</div><div style={{fontSize:36,letterSpacing:-1,marginBottom:16}}>{v.t}</div><div style={{fontSize:25,color:"#B9C4B5"}}>{v.b}</div></Enter>)}</div>
 </AbsoluteFill>}
function Separation(){return <AbsoluteFill style={stage}><Header chapter="POT token · Proposed concept"/>
  <Enter style={{position:"absolute",left:96,top:240}}><Title size={86}>USDC funds<br/>the goal.</Title><Body>The token could coordinate<br/>the network around it.</Body></Enter>
  <div style={{position:"absolute",left:1000,top:230,width:750,display:"flex",gap:30}}>
   <Enter delay={10} style={{flex:1,borderRadius:24,background:C.white,padding:36,height:430,display:"flex",flexDirection:"column",justifyContent:"space-between"}}><div style={{fontSize:62,color:C.green}}>USDC</div><div><div style={{fontSize:30,marginBottom:15}}>Money in the pot</div><div style={{fontSize:24,lineHeight:1.4,color:C.muted}}>Contributions.<br/>Payouts. Refunds.</div></div></Enter>
   <Enter delay={45} style={{flex:1,borderRadius:24,background:C.lime,padding:36,height:430,display:"flex",flexDirection:"column",justifyContent:"space-between"}}><Pool size={95}/><div><div style={{fontSize:30,marginBottom:15}}>Network participation</div><div style={{fontSize:24,lineHeight:1.4}}>Governance.<br/>Grants. Useful work.</div></div></Enter>
  </div>
 </AbsoluteFill>}
function Closing(){return <AbsoluteFill style={{...stage,background:C.lime}}><Header chapter="Good things, pooled."/>
  <Enter style={{position:"absolute",left:96,top:260}}><Title size={124}>Big plans.<br/>One shared pot.</Title><Body style={{color:C.ink,fontSize:34}}>From one birthday gift<br/>to a network of shared possibilities.</Body></Enter>
  <Enter delay={30} style={{position:"absolute",right:100,top:290}}><Pool size={370}/></Enter>
  <Enter delay={70} style={{position:"absolute",left:96,bottom:180,display:"flex",gap:32,alignItems:"center",fontSize:34}}><span>potonbase.vercel.app</span><Arrow size={36}/></Enter>
 </AbsoluteFill>}

const shots=[Problem,Introduce,Plan,Contribute,Settlement,Crowdfunding,Future,Token,Separation,Closing];
const captions: {start:number;end:number;text:string}[]=[];
let group:typeof rawWords=[];
for(const w of rawWords){group.push(w);if(group.length>=8 || /[.!?]$/.test(w.text)){captions.push({start:1.2+group[0].start/.93,end:1.2+w.end/.93,text:group.map(w=>w.text).join(" ")});group=[];}}
function Captions(){const frame=useCurrentFrame();const now=frame/60;const line=captions.find(c=>now>=c.start&&now<c.end+.08);return line?<div style={{position:"absolute",bottom:34,left:150,right:150,textAlign:"center",pointerEvents:"none"}}><span style={{display:"inline-block",fontSize:27,lineHeight:1.35,padding:"12px 24px",borderRadius:12,color:C.white,background:"rgba(20,27,25,.92)",maxWidth:1500}}>{line.text}</span></div>:null;}
export function Launch(){const f=useCurrentFrame();return <FontReady><AbsoluteFill style={stage}>
  {shots.map((Shot,i)=><Sequence key={i} from={scenes[i]} durationInFrames={scenes[i+1]-scenes[i]}><Shot/></Sequence>)}
  <Sequence from={72}><Audio src={staticFile("narration.mp3")} volume={1}/></Sequence>
  <Audio src={staticFile("score.mp3")} volume={frame=>interpolate(frame,[0,90,5160,5399],[0,.5,.5,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}/>
  <Captions/>
  <div style={{position:"absolute",bottom:0,left:0,height:4,width:`${100*f/5399}%`,background:C.green}}/>
</AbsoluteFill></FontReady>}

export function ProductScreenshot({variant}:{variant:number}){
 return <FontReady><AbsoluteFill style={{...stage,background:variant===1||variant===5?C.ink:C.paper}}>
  <Header dark={variant===1||variant===5} chapter={["Big plans. One shared pot.","Your idea. Your goal. Your rules.","For the plans you make together","Clear before anyone chips in","Designed for your group chat","Good things, pooled."][variant]}/>
  {variant===0&&<><div style={{position:"absolute",left:96,top:290}}><Title size={112}>Big plans.<br/>One shared <span style={{color:C.green}}>pot.</span></Title><Body>The trip. The gift. The idea everyone’s in on.</Body><div style={{display:"inline-flex",alignItems:"center",gap:40,marginTop:42,padding:"22px 30px",background:C.lime,borderRadius:12,fontSize:28}}>Plan your pot <Arrow size={30}/></div></div><Screen file="trip-card.png" width={590} style={{position:"absolute",right:96,top:180,maxHeight:810}}/></>}
  {variant===1&&<><div style={{position:"absolute",left:96,top:285}}><Tag dark>One clear plan for everyone</Tag><Title dark size={100}>Make the terms<br/><span style={{color:C.lime}}>part of the plan.</span></Title><Body dark>A goal. A deadline.<br/>A clear refund rule.</Body></div><Screen file="plan-summary.png" width={620} style={{position:"absolute",right:96,top:170,maxHeight:830}}/></>}
  {variant===2&&<><Title size={70} style={{position:"absolute",left:96,top:185}}>A little from everyone. Something for all of you.</Title><div style={{position:"absolute",left:96,right:96,top:335,display:"flex",gap:32}}>{["trip-card.png","gift-card.png","community-card.png"].map(file=><Screen key={file} file={file} width={530}/>)}</div></>}
  {variant===3&&<><div style={{position:"absolute",left:96,top:265,width:650}}><Title size={96}>Money rules.<br/><span style={{color:C.green}}>No guessing.</span></Title><Body>Agree on what happens before<br/>anyone contributes.</Body></div><Screen file="rules.png" width={890} style={{position:"absolute",right:96,top:230}}/></>}
  {variant===4&&<><div style={{position:"absolute",left:96,top:290}}><Title size={96}>Your people.<br/>Your next<br/><span style={{color:C.green}}>good thing.</span></Title><Body>One shared plan,<br/>wherever your group is.</Body></div><div style={{position:"absolute",left:1020,top:170,width:450,height:590,borderRadius:44,background:C.ink,padding:12,boxShadow:"0 16px 30px rgba(20,27,25,.12)"}}><Screen file="mobile-hero.png" width={426} style={{height:566,borderRadius:34}}/></div><Screen file="gift-card.png" width={395} style={{position:"absolute",left:1420,top:430,maxHeight:520}}/></>}
  {variant===5&&<><div style={{position:"absolute",left:96,top:210}}><Title dark size={80}>Turn “we should”<br/>into <span style={{color:C.lime}}>a shared plan.</span></Title></div><Screen file="plan-fields.png" width={600} style={{position:"absolute",left:96,top:450,maxHeight:520}}/><Screen file="plan-summary.png" width={550} style={{position:"absolute",right:130,top:170,maxHeight:820}}/><div style={{position:"absolute",left:780,top:635}}><Arrow size={90} color={C.lime}/></div></>}
 </AbsoluteFill></FontReady>;
}
